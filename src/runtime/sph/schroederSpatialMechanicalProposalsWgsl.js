// Extracted from schroederSpatialMechanicalProposalsGpu.js (Gate 6 Phase D mechanical decomposition).

import {
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_SOURCE_LOCAL_LINEAR_PROBE,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_BASE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_EMPTY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_BUILDING,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  createSchroederSpatialMechanicalPairGraphCapacityPlan,
  schroederSpatialMechanicalMatchingCleanupControlWordsForPasses
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M,
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
} from './sphCanonicalContactMotionBound.js';

import {
  MATCHING_CLEANUP_CONTROL_MAGIC,
  MATCHING_CLEANUP_CONTROL_VERSION,
  MECHANICAL_SUPPORT_HEADER_WORDS,
  MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD,
  MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD,
  MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET,
  MECHANICAL_SUPPORT_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
  SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION,
  SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR,
  SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S,
  mechanicalContactGraphParamsWgsl
} from './schroederSpatialMechanicalProposalsContracts.js';


export const schroederSpatialMechanicalGraphControlWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read_write> source_counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> source_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> append_records: array<u32>;
@group(0) @binding(3) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(9) var<storage, read_write> global_support_bits: array<atomic<u32>>;

fn mechanical_graph_control_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

fn mechanical_graph_control_lineage_layout_valid() -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  let lane_count = mechanical_params.phase_lane_count;
  if (capacity == 0u || lane_count == 0u) {
    return capacity == 0u && lane_count == 0u;
  }
  return lane_count == 4u
    && capacity <= 0xffffffffu / lane_count
    && capacity * lane_count == mechanical_params.particle_count;
}

fn mechanical_graph_control_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_graph_control_fail(bit: u32) {
  atomicOr(&graph_control[14u], bit);
}

fn mechanical_graph_store_conditional_dispatch(
  word_offset: u32,
  dispatch_x: u32
) {
  atomicStore(&graph_control[word_offset], dispatch_x);
  atomicStore(&graph_control[word_offset + 1u], 1u);
  atomicStore(&graph_control[word_offset + 2u], 1u);
}

@compute @workgroup_size(64)
fn initialize_contact_graph(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  source_counts[particle_index] = 0u;
  source_offsets[particle_index] = 0u;
  particle_scales[particle_index] = vec4<f32>(1.0);
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  if (particle_index != 0u) { return; }
  for (var word = 0u;
    word < ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u;
    word = word + 1u) {
    atomicStore(&graph_control[word], 0u);
  }
  atomicStore(
    &graph_control[0u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
  );
  atomicStore(
    &graph_control[1u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
  );
  atomicStore(&graph_control[2u], mechanical_params.generation_id);
  atomicStore(&graph_control[3u], mechanical_params.storage_generation);
  atomicStore(&graph_control[4u], mechanical_params.physics_tick);
  atomicStore(&graph_control[5u], mechanical_params.physics_substep);
  atomicStore(&graph_control[6u], mechanical_params.position_epoch);
  atomicStore(&graph_control[7u], mechanical_params.topology_epoch);
  atomicStore(&graph_control[8u], mechanical_params.support_epoch);
  atomicStore(
    &graph_control[9u],
    bitcast<u32>(mechanical_params.apply_selected_level)
  );
  atomicStore(
    &graph_control[10u],
    mechanical_params.directed_pair_capacity
  );
  atomicStore(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
  );
  // The following support-reduction dispatch authors this certificate.  It
  // starts unset so no source can mistake a fresh all-zero buffer for a
  // homogeneous liquid population before every active endpoint has checked
  // its phase and material identity.
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u],
    ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
  );
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u],
    0u
  );
  atomicStore(&graph_control[29u], 0u);
  atomicStore(&graph_control[30u], 1u);
  atomicStore(&graph_control[31u], 1u);
  source_offsets[mechanical_params.particle_count] = 0u;
  source_offsets[arrayLength(&source_counts)] = 0u;
}

@compute @workgroup_size(1)
fn finalize_contact_graph_counts() {
  if (
    !mechanical_graph_control_header_valid()
    || !mechanical_graph_control_lineage_layout_valid()
    || (
      atomicLoad(&graph_control[15u])
        & (
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
        )
    ) != (
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
    )
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
  }
  let particle_count = mechanical_params.particle_count;
  let last_index = particle_count - 1u;
  let last_offset = source_offsets[last_index];
  let last_count = source_counts[last_index];
  var required_count = 0xffffffffu;
  if (last_offset <= 0xffffffffu - last_count) {
    required_count = last_offset + last_count;
  } else {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
    );
  }
  source_offsets[particle_count] = required_count;
  source_offsets[arrayLength(&source_counts)] = required_count;
  atomicStore(&graph_control[12u], required_count);
  atomicStore(&traversal_evidence[16u], required_count);
  let append_attempt_count = atomicLoad(&graph_control[11u]);
  atomicStore(&traversal_evidence[14u], append_attempt_count);
  if (required_count != append_attempt_count) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.SCAN_COUNT_MISMATCH}u
    );
  }
  if (
    required_count > mechanical_params.directed_pair_capacity
    || append_attempt_count > mechanical_params.directed_pair_capacity
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
    );
  }
  atomicAdd(&traversal_evidence[24u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
  );
  if (atomicLoad(&graph_control[14u]) == 0u) {
    atomicStore(
      &graph_control[29u],
      (required_count + 63u) / 64u
    );
    if (required_count == 0u) {
      atomicOr(
        &graph_control[15u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
      );
    }
  } else {
    atomicStore(&graph_control[29u], 0u);
  }
  let path_admitted = atomicLoad(&graph_control[14u]) == 0u;
  let particle_workgroups = (
    mechanical_params.particle_count + 63u
  ) / 64u;
  let has_directed_pairs = required_count != 0u;
  // A zero CSR alone cannot bypass the normal solver: its wall projection is
  // still a real mechanical law. The support reduction provides an exact
  // current-state wall certificate, so only an admitted zero graph with no
  // possible wall projection takes the zero-edge completion path.
  let no_wall_projection = arrayLength(&global_support_bits) >= 3u
    && bitcast<f32>(atomicLoad(&global_support_bits[2u])) == 0.0;
  let zero_edge_path = path_admitted
    && !has_directed_pairs
    && no_wall_projection;
  atomicStore(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u],
    select(0u, 1u, path_admitted && !zero_edge_path)
  );
  mechanical_graph_store_conditional_dispatch(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u,
    select(0u, particle_workgroups, zero_edge_path)
  );
}

@compute @workgroup_size(64)
fn scatter_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let append_index = global_id.x;
  let total = atomicLoad(&graph_control[12u]);
  if (
    append_index >= total
    || atomicLoad(&graph_control[14u]) != 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    ) == 0u
  ) { return; }
  let append_base = append_index * 3u;
  let self_index = append_records[append_base];
  let other_index = append_records[append_base + 1u];
  let local_rank = append_records[append_base + 2u];
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || local_rank >= source_counts[self_index]
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[20u], 1u);
    return;
  }
  let source_offset = source_offsets[self_index];
  if (
    source_offset > total
    || local_rank > total - source_offset
    || source_offset + local_rank >= total
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  csr_peers[source_offset + local_rank] = other_index;
  atomicAdd(&graph_control[13u], 1u);
  if (append_index == 0u) {
    atomicAdd(&traversal_evidence[25u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    );
  }
}

fn mechanical_graph_control_peer_hash(peer_index: u32, slot_count: u32) -> u32 {
  return (peer_index * 2654435761u) % max(slot_count, 1u);
}

// The staging arena is dead after CSR scatter. Reuse its three words per
// directed edge as a source-local exact peer set. One invocation owns each
// source segment, so construction is race-free; the following dispatch is the
// storage barrier before reciprocal lookup. At one-third load, successful and
// missing probes remain bounded without the former degree-squared scans.
@compute @workgroup_size(64)
fn index_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  // The finalizer has authenticated a complete zero-edge graph and selected
  // the separate zero-edge completion dispatch.  Do not manufacture normal
  // graph-verification evidence here: that path is completed atomically by
  // the zero-edge kernel after the direct CSR stages have been bypassed.
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    self_index >= mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[13u]) != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) { return; }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let degree = end - begin;
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  for (var slot = 0u; slot < slot_count; slot = slot + 1u) {
    append_records[table_begin + slot] = 0xffffffffu;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = csr_peers[cursor];
    var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
    var inserted = false;
    for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
      let table_index = table_begin + slot;
      let resident_peer = append_records[table_index];
      if (resident_peer == 0xffffffffu) {
        append_records[table_index] = peer_index;
        inserted = true;
        break;
      }
      if (resident_peer == peer_index) {
        mechanical_graph_control_fail(
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DUPLICATE_ENDPOINT}u
        );
        atomicAdd(&traversal_evidence[21u], 1u);
        inserted = true;
        break;
      }
      slot = (slot + 1u) % slot_count;
    }
    if (!inserted) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return;
    }
  }
}

fn mechanical_graph_control_row_contains(
  source_index: u32,
  peer_index: u32,
  total: u32
) -> bool {
  let begin = source_offsets[source_index];
  let end = source_offsets[source_index + 1u];
  if (begin > end || end > total) { return false; }
  let degree = end - begin;
  if (degree == 0u) { return false; }
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
  for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
    let resident_peer = append_records[table_begin + slot];
    if (resident_peer == peer_index) { return true; }
    if (resident_peer == 0xffffffffu) { return false; }
    slot = (slot + 1u) % slot_count;
  }
  return false;
}

@compute @workgroup_size(64)
fn validate_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (self_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[14u]) != 0u) { return; }
  if (
    atomicLoad(&graph_control[13u])
      != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  var source_valid = true;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    if (
      other_index >= mechanical_params.particle_count
      || other_index == self_index
    ) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (mechanical_graph_control_same_phase_lineage(
      self_index,
      other_index
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (!mechanical_graph_control_row_contains(
      other_index,
      self_index,
      total
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MISSING_RECIPROCAL}u
      );
      atomicAdd(&traversal_evidence[22u], 1u);
      source_valid = false;
    }
  }
  if (source_valid) {
    // Graph construction no longer needs the per-row build metadata after
    // reciprocal CSR validation. Compact the immutable Jacobi geometry into
    // one aligned vec4 at row words 2..5: epoch xyz followed by diameter.
    // The solver can then consume one coalesced load per endpoint instead of
    // re-reading volume and three separately addressed epoch words per law.
    let support_base = ${MECHANICAL_SUPPORT_HEADER_WORDS}u
      + self_index * ${MECHANICAL_SUPPORT_ROW_WORDS}u;
    let diameter_bits = atomicLoad(&global_support_bits[support_base]);
    let epoch_x_bits = atomicLoad(&global_support_bits[support_base + 4u]);
    let epoch_y_bits = atomicLoad(&global_support_bits[support_base + 5u]);
    let epoch_z_bits = atomicLoad(&global_support_bits[support_base + 6u]);
    atomicStore(&global_support_bits[support_base + 2u], epoch_x_bits);
    atomicStore(&global_support_bits[support_base + 3u], epoch_y_bits);
    atomicStore(&global_support_bits[support_base + 4u], epoch_z_bits);
    atomicStore(&global_support_bits[support_base + 5u], diameter_bits);
    atomicAdd(&graph_control[16u], 1u);
  }
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    );
  }
}
`;

const mechanicalSolverInputStateReadWriteDeclarationWgsl =
  '@group(0) @binding(0) var<storage, read_write> input_state: array<vec4<f32>>;';

function createSchroederSpatialMechanicalGraphSolverCoreWgsl(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

struct MechanicalSolverIterationParams {
  iteration: u32,
  reserved_0: u32,
  reserved_1: u32,
  reserved_2: u32,
};

${mechanicalSolverInputStateReadWriteDeclarationWgsl}
@group(0) @binding(1) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> source_identity: array<u32>;
@group(0) @binding(5) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(6) var<storage, read> source_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read> spatial_source_rows: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(12) var<storage, read_write> energy_ledger: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read_write> matching_constraints:
  array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> matching_cleanup_dispatch:
  array<atomic<u32>>;
@group(0) @binding(15) var<storage, read_write> mechanical_diagnostic_trace:
  array<atomic<u32>>;
@group(0) @binding(16) var<uniform> mechanical_solver_iteration:
  MechanicalSolverIterationParams;

var<workgroup> mechanical_matching_persistent_pass: u32;
var<workgroup> mechanical_matching_persistent_active_count: u32;
var<workgroup> mechanical_matching_persistent_contact_count: u32;
var<workgroup> mechanical_matching_persistent_dispatch_active: u32;

const MECHANICAL_DIAGNOSTIC_TRACE_MAGIC: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC}u;
const MECHANICAL_DIAGNOSTIC_TRACE_VERSION: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION}u;
const MECHANICAL_DIAGNOSTIC_TRACE_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_VALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.HEADER_VALID}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .LOCAL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .POST_WALL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_WINNER_TARGET_MATCH: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .WINNER_TARGET_MATCH}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.INVALID >>> 0}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_SELECTED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.SELECTED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_RECIPROCAL: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.RECIPROCAL}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.APPLIED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.TARGET_IS_LOW}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .PAIR_CONTAINS_BOTH_TARGETS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_TARGET_WALL_CLIPPED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .ROUND_ZERO_TARGET_WALL_CLIPPED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_PEER_WALL_CLIPPED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .ROUND_ZERO_PEER_WALL_CLIPPED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_LOCAL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .LOCAL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .POST_WALL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CHANGED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .POST_WALL_CHANGED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_THREE_BLOCK_APPLIED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .THREE_BLOCK_APPLIED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_HEADER_VALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.HEADER_VALID}u;
const MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.APPLY_OBSERVED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_TERMINAL_MEASURED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.TERMINAL_MEASURED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_WINNER_MATERIALIZED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.WINNER_MATERIALIZED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_PRODUCTION_MAX_MATCH: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.PRODUCTION_MAX_MATCH}u;
const MECHANICAL_DIAGNOSTIC_TRACE_IMPULSE_FINITE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.IMPULSE_FINITE}u;
const MECHANICAL_DIAGNOSTIC_TRACE_INVALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.INVALID >>> 0}u;

struct MechanicalPairResidual {
  barrier_dx: vec3<f32>,
  barrier_dv: vec3<f32>,
  soft_dx: vec3<f32>,
  soft_dv: vec3<f32>,
  velocity_normal: vec3<f32>,
  position_residual: f32,
  velocity_residual: f32,
  unilateral: u32,
  active_pair: u32,
  valid: u32,
};

struct MechanicalMatchingWallVelocityProjection {
  velocity: vec3<f32>,
  kinetic_delta_j: f32,
  clipped: u32,
  failure_code: u32,
  valid: u32,
};

struct MechanicalMatchingAxisWallConstraint {
  inward_scalar_sign: f32,
  geometry_active: u32,
  valid: u32,
};

struct MechanicalMatchingAxisActiveSetResult {
  primary_u: f32,
  center_u: f32,
  secondary_u: f32,
  primary_lambda: f32,
  secondary_lambda: f32,
  wall_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourBlockAxisResult {
  velocity: vec4<f32>,
  objective: f32,
  contact_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourBlockBoxAxisResult {
  velocity: vec4<f32>,
  contact_lambda: vec3<f32>,
  objective: f32,
  contact_mask: u32,
  wall_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourWallEnergyAllocation {
  delta_j: vec4<f32>,
  valid: u32,
};

struct MechanicalMatchingFourPathCandidate {
  body_0_index: u32,
  body_1_index: u32,
  body_2_index: u32,
  body_3_index: u32,
  edge_0_forward_cursor: u32,
  edge_0_reverse_cursor: u32,
  edge_1_forward_cursor: u32,
  edge_1_reverse_cursor: u32,
  edge_2_forward_cursor: u32,
  edge_2_reverse_cursor: u32,
  light_mass_ratio: f32,
  bridge_rank: u32,
  found: u32,
  valid: u32,
};

struct MechanicalMatchingVelocityRefinement {
  low_velocity: vec3<f32>,
  high_velocity: vec3<f32>,
  low_pair_kinetic_delta_j: f32,
  high_pair_kinetic_delta_j: f32,
  low_wall_kinetic_delta_j: f32,
  high_wall_kinetic_delta_j: f32,
  low_pair_impulse: vec3<f32>,
  high_pair_impulse: vec3<f32>,
  round_count: u32,
  failure_code: u32,
  valid: u32,
};

struct MechanicalMatchingThreeBlockResult {
  center_index: u32,
  primary_index: u32,
  secondary_index: u32,
  center_primary_cursor: u32,
  primary_center_cursor: u32,
  center_secondary_cursor: u32,
  secondary_center_cursor: u32,
  center_velocity: vec3<f32>,
  primary_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  center_kinetic_delta_j: f32,
  primary_kinetic_delta_j: f32,
  secondary_kinetic_delta_j: f32,
  center_wall_kinetic_delta_j: f32,
  primary_wall_kinetic_delta_j: f32,
  secondary_wall_kinetic_delta_j: f32,
  pair_heat_j: f32,
  center_primary_impulse: vec3<f32>,
  primary_impulse: vec3<f32>,
  center_secondary_impulse: vec3<f32>,
  secondary_impulse: vec3<f32>,
  tertiary_index: u32,
  center_tertiary_cursor: u32,
  tertiary_center_cursor: u32,
  tertiary_velocity: vec3<f32>,
  tertiary_kinetic_delta_j: f32,
  tertiary_wall_kinetic_delta_j: f32,
  center_tertiary_impulse: vec3<f32>,
  tertiary_impulse: vec3<f32>,
  member_count: u32,
  block_found: u32,
  applied: u32,
  failure_code: u32,
  valid: u32,
  topology: u32,
  path_owner: u32,
};

// Particle dispatch is constructor-bounded far below 2^30, so both peer high
// bits are solver-private cache lanes. Measure owns each directed CSR row and records
// whether the edge has a law in the unchanged iteration input. Solve and
// energy allocation can then skip the broad retained closure edges that were
// measured inactive without evaluating the swept pair law two more times. The
// matching owner keeps the second bit once a frozen cursor has ever become
// active, so expansion owns never-active rows and selection owns ever-active
// rows instead of both evaluating the complete incident CSR. Final residual
// verification restores public peer indices before publication or retention.
const MECHANICAL_SOLVER_EDGE_INACTIVE_BIT: u32 = 0x80000000u;
const MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT: u32 = 0x40000000u;
const MECHANICAL_SOLVER_EDGE_PEER_MASK: u32 = 0x3fffffffu;
const MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD: u32 = 3u;
const MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD: u32 = 4u;
const MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS}u;
const MECHANICAL_MATCHING_OWNER_FRONTIER_BIT: u32 = 0x00000001u;
const MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT: u32 = 0x00000002u;
// Set when a particle's state changed since its last wall evaluation; the
// wall phase claims (clears) it exactly once, so duplicate mover-list
// entries can never double-project a member within one logical pass.
const MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT: u32 = 0x00000004u;
const MECHANICAL_MATCHING_OWNER_CONTACT_BIT: u32 = 0x80000000u;

fn mechanical_solver_full_path_enabled() -> bool {
  return atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) != 0u;
}

fn mechanical_solver_peer_index(encoded_peer: u32) -> u32 {
  return encoded_peer & MECHANICAL_SOLVER_EDGE_PEER_MASK;
}

fn mechanical_solver_edge_inactive(encoded_peer: u32) -> bool {
  return (encoded_peer & MECHANICAL_SOLVER_EDGE_INACTIVE_BIT) != 0u;
}

fn mechanical_matching_edge_ever_active(encoded_peer: u32) -> bool {
  return (encoded_peer & MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT) != 0u;
}

fn mechanical_matching_mark_edge_inactive(encoded_peer: u32) -> u32 {
  return encoded_peer | MECHANICAL_SOLVER_EDGE_INACTIVE_BIT;
}

fn mechanical_solver_encode_measured_peer(
  peer_index: u32,
  edge_is_active: bool
) -> u32 {
  return peer_index | select(
    MECHANICAL_SOLVER_EDGE_INACTIVE_BIT,
    0u,
    edge_is_active
  );
}

fn mechanical_solver_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_solver_finite3(value: vec3<f32>) -> bool {
  return mechanical_solver_finite(value.x)
    && mechanical_solver_finite(value.y)
    && mechanical_solver_finite(value.z);
}

fn mechanical_diagnostic_trace_header_valid() -> bool {
  let capacity_valid =
    arrayLength(&mechanical_diagnostic_trace)
      >= MECHANICAL_DIAGNOSTIC_TRACE_WORDS;
  if (!capacity_valid) { return false; }
  let valid =
    atomicLoad(&mechanical_diagnostic_trace[0u])
        == MECHANICAL_DIAGNOSTIC_TRACE_MAGIC
      && atomicLoad(&mechanical_diagnostic_trace[1u])
        == MECHANICAL_DIAGNOSTIC_TRACE_VERSION
      && atomicLoad(&mechanical_diagnostic_trace[3u])
        == mechanical_params.generation_id
      && atomicLoad(&mechanical_diagnostic_trace[4u])
        == mechanical_params.storage_generation
      && atomicLoad(&mechanical_diagnostic_trace[5u])
        == mechanical_params.physics_tick
      && atomicLoad(&mechanical_diagnostic_trace[6u])
        == mechanical_params.physics_substep
      && atomicLoad(&mechanical_diagnostic_trace[7u])
        == mechanical_params.position_epoch
      && atomicLoad(&mechanical_diagnostic_trace[8u])
        == mechanical_params.topology_epoch
      && atomicLoad(&mechanical_diagnostic_trace[9u])
        == mechanical_params.support_epoch
      && atomicLoad(&mechanical_diagnostic_trace[10u])
        == mechanical_params.particle_count
      && atomicLoad(&mechanical_diagnostic_trace[11u])
        == ${solverBudget.cleanupPassBudget}u;
  if (!valid) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
  }
  return valid;
}

fn mechanical_diagnostic_trace_load_f32(word: u32) -> f32 {
  return bitcast<f32>(atomicLoad(&mechanical_diagnostic_trace[word]));
}

fn mechanical_diagnostic_trace_store_f32(word: u32, value: f32) {
  atomicStore(&mechanical_diagnostic_trace[word], bitcast<u32>(value));
}

fn mechanical_diagnostic_target_tail_header_valid() -> bool {
  if (
    arrayLength(&mechanical_diagnostic_trace)
      < MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS
  ) { return false; }
  let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
  let target_a = atomicLoad(&mechanical_diagnostic_trace[header + 6u]);
  let target_b = atomicLoad(&mechanical_diagnostic_trace[header + 7u]);
  let valid =
    atomicLoad(&mechanical_diagnostic_trace[header])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC
      && atomicLoad(&mechanical_diagnostic_trace[header + 1u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION
      && (
        atomicLoad(&mechanical_diagnostic_trace[header + 2u])
          & MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_VALID
      ) != 0u
      && (
        atomicLoad(&mechanical_diagnostic_trace[header + 2u])
          & MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
      ) == 0u
      && atomicLoad(&mechanical_diagnostic_trace[header + 3u])
        == ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&mechanical_diagnostic_trace[header + 4u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      && atomicLoad(&mechanical_diagnostic_trace[header + 5u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS
      && target_a < mechanical_params.particle_count
      && target_b < mechanical_params.particle_count
      && target_a != target_b;
  if (!valid) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
    );
  }
  return valid;
}

fn mechanical_diagnostic_target_index(target_slot: u32) -> u32 {
  return atomicLoad(
    &mechanical_diagnostic_trace[
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD + 6u + target_slot
    ]
  );
}

fn mechanical_diagnostic_target_row_word(
  pass_index: u32,
  target_slot: u32,
  row_word: u32
) -> u32 {
  return MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD
    + (
      pass_index * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
        + target_slot
    ) * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS
    + row_word;
}

fn mechanical_diagnostic_target_row_store_f32(
  pass_index: u32,
  target_slot: u32,
  row_word: u32,
  value: f32
) {
  mechanical_diagnostic_trace_store_f32(
    mechanical_diagnostic_target_row_word(
      pass_index,
      target_slot,
      row_word
    ),
    value
  );
}

fn mechanical_diagnostic_target_row_store_vec3(
  pass_index: u32,
  target_slot: u32,
  row_word: u32,
  value: vec3<f32>
) {
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word,
    value.x
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word + 1u,
    value.y
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word + 2u,
    value.z
  );
}

fn mechanical_solver_zero_pair(valid: u32) -> MechanicalPairResidual {
  return MechanicalPairResidual(
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u,
    valid
  );
}

fn mechanical_solver_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_solver_wall_boundary_tolerance_m(
  boundary_m: f32,
  opposite_boundary_m: f32
) -> f32 {
  let span_m = abs(opposite_boundary_m - boundary_m);
  return min(
    8.0 * 1.1920929e-7 * max(abs(boundary_m), 1.0e-12),
    0.25 * span_m
  );
}

fn mechanical_solver_source_row_base(index: u32) -> u32 {
  return index * 16u;
}

fn mechanical_solver_epoch_position(index: u32) -> vec3<f32> {
  let source_vec4_base = mechanical_solver_source_row_base(index) / 4u;
  return spatial_source_rows[source_vec4_base + 3u].xyz;
}

// The graph support reduction has already authenticated and materialized the
// immutable diameter/epoch geometry for every active endpoint and dormant
// trust carrier. CSR validation compacts it to one aligned vec4 per row.
// Jacobi pipelines bind that support buffer at binding 9, while cleanup and
// terminal verification bind the original 16-float source rows there.
const MECHANICAL_JACOBI_GEOMETRY_VEC4_OFFSET: u32 =
  ${((MECHANICAL_SUPPORT_HEADER_WORDS + 2) / 4) >>> 0}u;
const MECHANICAL_JACOBI_GEOMETRY_VEC4_STRIDE: u32 =
  ${(MECHANICAL_SUPPORT_ROW_WORDS / 4) >>> 0}u;

fn mechanical_solver_jacobi_cache_header_valid() -> bool {
  var required_vec4_count = MECHANICAL_JACOBI_GEOMETRY_VEC4_OFFSET;
  if (mechanical_params.particle_count > 0u) {
    required_vec4_count = MECHANICAL_JACOBI_GEOMETRY_VEC4_OFFSET
      + (mechanical_params.particle_count - 1u)
        * MECHANICAL_JACOBI_GEOMETRY_VEC4_STRIDE
      + 1u;
  }
  return arrayLength(&spatial_source_rows) >= required_vec4_count
    && bitcast<u32>(spatial_source_rows[0u].w)
      == mechanical_params.particle_count;
}

fn mechanical_solver_jacobi_geometry(
  index: u32
) -> vec4<f32> {
  if (index >= mechanical_params.particle_count) {
    return vec4<f32>(0.0);
  }
  return spatial_source_rows[
    MECHANICAL_JACOBI_GEOMETRY_VEC4_OFFSET
      + index * MECHANICAL_JACOBI_GEOMETRY_VEC4_STRIDE
  ];
}

fn mechanical_solver_jacobi_geometry_valid(
  geometry: vec4<f32>
) -> bool {
  return mechanical_solver_finite3(geometry.xyz)
    && mechanical_solver_finite(geometry.w)
    && geometry.w > 0.0;
}

fn mechanical_solver_selected(index: u32) -> bool {
  // The verified CSR graph already carries the constructor-bound level
  // selection. The solver must consume that graph, not reinterpret either of
  // the two admitted 16-float spatial-source row ABIs.
  return index < mechanical_params.particle_count;
}

fn mechanical_solver_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_solver_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_solver_same_body_solid_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  if (
    mechanical_solver_phase_class(self_index) != 2u
    || mechanical_solver_phase_class(other_index) != 2u
  ) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if ((mechanical_params.identity_enabled & 1u) == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u
    || other_domain == 0u
    || self_domain == other_domain;
}

fn mechanical_solver_unilateral_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (self_class == 0u || other_class == 0u) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return true; }
  let solid_liquid_interface = (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u);
  if (solid_liquid_interface) { return true; }
  if (
    self_class != 2u
    || other_class != 2u
    || (mechanical_params.identity_enabled & 1u) == 0u
  ) { return false; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain != 0u
    && other_domain != 0u
    && self_domain != other_domain;
}

fn mechanical_solver_coincidence_normal(
  self_index: u32,
  other_index: u32
) -> vec3<f32> {
  let low_index = min(self_index, other_index);
  var h = low_index * 2654435761u + 0x9e3779b9u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  let raw = vec3<f32>(
    f32(h & 1023u) / 511.5 - 1.0,
    f32((h >> 10u) & 1023u) / 511.5 - 1.0,
    f32((h >> 20u) & 1023u) / 511.5 - 1.0
  );
  let raw_length = length(raw);
  let normalized = select(
    vec3<f32>(0.0, 1.0, 0.0),
    raw / max(raw_length, 1.0e-6),
    raw_length > 1.0e-4
  );
  return normalized * select(-1.0, 1.0, self_index > other_index);
}

struct MechanicalFiniteVolumeContact {
  normal: vec3<f32>,
  response_normal: vec3<f32>,
  response_projection: f32,
  support_distance_m: f32,
  overlap_m: f32,
  swept_contact: u32,
  admitted: u32,
};

fn mechanical_solver_aabb_tangent_zero_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  // Reject edge/corner-only contacts whose apparent tangential overlap is
  // solely binary32 subtraction roundoff. Unlike the normal shell, this is a
  // strict zero-area predicate and never admits a mechanical constraint.
  return 16.0 * 1.1920929e-7 * geometric_scale_m;
}

fn mechanical_solver_aabb_face(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32,
  normal_tolerance_m: f32
) -> vec2<u32> {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let separation_m = abs(delta_m) - vec3<f32>(half_sum_m);
  var normal_axis = 0u;
  if (separation_m.y > separation_m.x) { normal_axis = 1u; }
  if (
    separation_m.z
      > select(separation_m.x, separation_m.y, normal_axis == 1u)
  ) { normal_axis = 2u; }
  if (
    separation_m.x > normal_tolerance_m
    || separation_m.y > normal_tolerance_m
    || separation_m.z > normal_tolerance_m
  ) { return vec2<u32>(0u); }
  var tangent_a = 0.0;
  var tangent_b = 0.0;
  if (normal_axis == 0u) {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.y)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.z)
    );
  } else if (normal_axis == 1u) {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.x)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.z)
    );
  } else {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.x)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.y)
    );
  }
  let tangent_zero_tolerance_m =
    mechanical_solver_aabb_tangent_zero_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  return vec2<u32>(
    normal_axis,
    select(
      0u,
      1u,
      tangent_a > tangent_zero_tolerance_m
        && tangent_b > tangent_zero_tolerance_m
    )
  );
}

fn mechanical_solver_aabb_normal_roundoff_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  // Bound the numerical contact shell to eight binary32 roundoff steps at the
  // local cell scale, with a hard 1e-4 support-relative cap. The response
  // overlap remains max(..., 0), so this only retains a closing velocity
  // constraint and never pulls a separated pair together.
  return min(
    8.0 * 1.1920929e-7 * geometric_scale_m,
    1.0e-4 * half_sum_m
  );
}

fn mechanical_solver_swept_aabb_axis_interval(
  start_m: f32,
  sweep_m: f32,
  half_sum_m: f32
) -> vec3<f32> {
  if (abs(sweep_m) <= 1.0e-12) {
    if (abs(start_m) > half_sum_m) { return vec3<f32>(0.0); }
    return vec3<f32>(-3.402823e+38, 3.402823e+38, 1.0);
  }
  let first_t = (-half_sum_m - start_m) / sweep_m;
  let second_t = (half_sum_m - start_m) / sweep_m;
  return vec3<f32>(
    min(first_t, second_t),
    max(first_t, second_t),
    1.0
  );
}

fn mechanical_solver_finite_volume_contact(
  self_index: u32,
  other_index: u32,
  delta_m: vec3<f32>,
  epoch_delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> MechanicalFiniteVolumeContact {
  let rejected = MechanicalFiniteVolumeContact(
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0u,
    0u
  );
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let normal_roundoff_tolerance_m =
    mechanical_solver_aabb_normal_roundoff_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  let current_face = mechanical_solver_aabb_face(
    delta_m,
    self_edge_m,
    other_edge_m,
    normal_roundoff_tolerance_m
  );
  let sweep_delta_m = delta_m - epoch_delta_m;
  var swept_admitted = false;
  var impact_t = 0.0;
  var impact_delta_m = vec3<f32>(0.0);
  var impact_normal_axis = 0u;
  if (length(sweep_delta_m) > 1.0e-12) {
    let interval_x = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.x,
      sweep_delta_m.x,
      half_sum_m
    );
    let interval_y = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.y,
      sweep_delta_m.y,
      half_sum_m
    );
    let interval_z = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.z,
      sweep_delta_m.z,
      half_sum_m
    );
    if (interval_x.z != 0.0 && interval_y.z != 0.0 && interval_z.z != 0.0) {
      let entry_t = max(interval_x.x, max(interval_y.x, interval_z.x));
      let exit_t = min(interval_x.y, min(interval_y.y, interval_z.y));
      if (entry_t <= exit_t && exit_t >= 0.0 && entry_t <= 1.0) {
        impact_t = clamp(entry_t, 0.0, 1.0);
        impact_delta_m = epoch_delta_m + impact_t * sweep_delta_m;
        let impact_face = mechanical_solver_aabb_face(
          impact_delta_m,
          self_edge_m,
          other_edge_m,
          mechanical_solver_aabb_normal_roundoff_tolerance_m(
            impact_delta_m,
            self_edge_m,
            other_edge_m
          )
        );
        impact_normal_axis = impact_face.x;
        swept_admitted = impact_face.y != 0u;
      }
    }
  }
  let cohort_inverted = dot(epoch_delta_m, delta_m) <= 0.0;
  var source_delta_m = vec3<f32>(0.0);
  var source_normal_axis = 0u;
  var admitted = false;
  if (
    swept_admitted
    && (
      current_face.y == 0u
      || cohort_inverted
      || max(
        abs(epoch_delta_m.x),
        max(abs(epoch_delta_m.y), abs(epoch_delta_m.z))
      ) >= half_sum_m
    )
  ) {
    source_delta_m = impact_delta_m;
    source_normal_axis = impact_normal_axis;
    admitted = true;
  } else if (current_face.y != 0u) {
    source_delta_m = delta_m;
    source_normal_axis = current_face.x;
    admitted = true;
  }
  // A center-vector inversion can occur while one tangential slab stays
  // disjoint. Require an actual current or swept finite-area face.
  if (!admitted) { return rejected; }
  let coincidence_normal = mechanical_solver_coincidence_normal(
    self_index,
    other_index
  );
  let source_normal_component = select(
    source_delta_m.x,
    select(source_delta_m.y, source_delta_m.z, source_normal_axis == 2u),
    source_normal_axis != 0u
  );
  let coincidence_normal_component = select(
    coincidence_normal.x,
    select(
      coincidence_normal.y,
      coincidence_normal.z,
      source_normal_axis == 2u
    ),
    source_normal_axis != 0u
  );
  let normal_sign = select(
    select(-1.0, 1.0, coincidence_normal_component >= 0.0),
    select(-1.0, 1.0, source_normal_component >= 0.0),
    abs(source_normal_component) > 1.0e-12
  );
  var normal = vec3<f32>(0.0);
  if (source_normal_axis == 0u) {
    normal.x = normal_sign;
  } else if (source_normal_axis == 1u) {
    normal.y = normal_sign;
  } else {
    normal.z = normal_sign;
  }
  // This finite-volume law has no rotational cell degree of freedom. Apply
  // only the admitted face-normal response so an off-axis sweep cannot create
  // equal-and-opposite artificial tangential material momentum.
  let response_normal = normal;
  let response_projection = 1.0;
  let support_distance_m = half_sum_m;
  let overlap_m = max(
    support_distance_m - dot(delta_m, normal),
    0.0
  );
  if (
    !mechanical_solver_finite3(normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 0.0
    || !mechanical_solver_finite(support_distance_m)
    || !mechanical_solver_finite(overlap_m)
  ) { return rejected; }
  return MechanicalFiniteVolumeContact(
    normal,
    response_normal,
    response_projection,
    support_distance_m,
    overlap_m,
    select(0u, 1u, swept_admitted),
    1u
  );
}

fn mechanical_solver_pair_response(
  self_index: u32,
  other_index: u32,
  self_mass: f32,
  other_mass: f32,
  overlap: f32,
  constraint_normal: vec3<f32>,
  response_normal: vec3<f32>,
  response_projection: f32,
  unilateral: bool,
  include_soft: bool
) -> MechanicalPairResidual {
  let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
  let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
  let inverse_mass_share = self_inverse_mass
    / (self_inverse_mass + other_inverse_mass);
  let self_velocity = input_state[self_index * 2u + 1u].xyz;
  let other_velocity = input_state[other_index * 2u + 1u].xyz;
  let approach = dot(
    self_velocity - other_velocity,
    constraint_normal
  );
  // Deduplication with canonical mechanics-field contact_fields: when bit 1
  // is set, the continuum mechanics-field solve already owns unilateral normal
  // velocity impulses for this step, so this stage applies positional
  // non-penetration (barrier_dx) without doubling velocity impulses.
  let velocity_handled_by_mechanics_field =
    (mechanical_params.identity_enabled & 2u) != 0u;
  var relative_dv = vec3<f32>(0.0);
  if (unilateral && approach < 0.0 && !velocity_handled_by_mechanics_field) {
    let proposed_relative_dv = -approach
      / max(response_projection, 1.0e-6)
      * response_normal;
    let central_linear_work_speed_squared = dot(
      self_velocity - other_velocity,
      proposed_relative_dv
    );
    let kinetic_delta_speed_squared =
      2.0 * central_linear_work_speed_squared
        + dot(proposed_relative_dv, proposed_relative_dv);
    let kinetic_tolerance_speed_squared =
      64.0 * 1.1920929e-7 * max(
        dot(
          self_velocity - other_velocity,
          self_velocity - other_velocity
        ),
        1.0
      );
    if (
      central_linear_work_speed_squared > 0.0
      || kinetic_delta_speed_squared > kinetic_tolerance_speed_squared
    ) {
      let radial_approach = dot(
        self_velocity - other_velocity,
        response_normal
      );
      let radial_dv = max(-radial_approach, 0.0) * response_normal;
      let velocity_after_radial =
        self_velocity - other_velocity + radial_dv;
      let face_dv = max(
        -dot(velocity_after_radial, constraint_normal),
        0.0
      ) * constraint_normal;
      relative_dv = radial_dv + face_dv;
    } else {
      relative_dv = proposed_relative_dv;
    }
  }
  var result = mechanical_solver_zero_pair(1u);
  result.active_pair = 1u;
  result.unilateral = select(0u, 1u, unilateral);
  result.position_residual = select(0.0, overlap, unilateral);
  result.velocity_residual = select(
    0.0,
    max(-approach, 0.0),
    unilateral && !velocity_handled_by_mechanics_field
  );
  if (unilateral) {
    result.barrier_dx = inverse_mass_share
      * overlap
      / max(response_projection, 1.0e-6)
      * response_normal;
    if (length(relative_dv) > 1.0e-12) {
      result.barrier_dv = inverse_mass_share * relative_dv;
      // The oblique response p f^T / dot(p,f) is an idempotent projection:
      // its eigenvalues remain 0/1 even when its singular value exceeds one.
      // Retain p in the Gershgorin basis so an isolated edge receives its
      // exact one-pass projection; the coupled trust scale and explicit
      // kinetic-energy guard remain authoritative for contact networks.
      let relative_dv_length = length(relative_dv);
      result.velocity_normal = select(
        constraint_normal,
        relative_dv / max(relative_dv_length, 1.0e-30),
        relative_dv_length > 1.0e-12
      );
    }
  } else if (include_soft) {
    result.soft_dx = mechanical_params.relaxation
      * inverse_mass_share * overlap * constraint_normal;
    if (approach < 0.0) {
      result.soft_dv = -mechanical_params.normal_velocity_damping
        * inverse_mass_share * approach * constraint_normal;
      result.velocity_normal = constraint_normal;
    }
  }
  if (
    !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || !mechanical_solver_finite3(relative_dv)
    || response_projection <= 0.0
    || !mechanical_solver_finite3(result.barrier_dx)
    || !mechanical_solver_finite3(result.barrier_dv)
    || !mechanical_solver_finite3(result.soft_dx)
    || !mechanical_solver_finite3(result.soft_dv)
    || !mechanical_solver_finite3(result.velocity_normal)
    || !mechanical_solver_finite(result.position_residual)
    || !mechanical_solver_finite(result.velocity_residual)
  ) {
    result.valid = 0u;
  }
  return result;
}

fn mechanical_solver_pair(
  self_index: u32,
  other_index: u32,
  include_soft: bool,
  self_geometry: vec4<f32>,
  other_geometry: vec4<f32>
) -> MechanicalPairResidual {
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || !mechanical_solver_selected(self_index)
    || !mechanical_solver_selected(other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  if (mechanical_solver_same_phase_lineage(self_index, other_index)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
    return mechanical_solver_zero_pair(1u);
  }
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (
    self_class == 0u
    || other_class == 0u
    || mechanical_solver_same_body_solid_pair(self_index, other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  let unilateral = mechanical_solver_unilateral_pair(self_index, other_index);
  // Non-unilateral pairs are optional same-material liquid relaxation. After
  // the first Jacobi round, and during strict residual verification, they have
  // no law to evaluate. Reject them before loading geometry or sweep history.
  if (!unilateral && !include_soft) {
    return mechanical_solver_zero_pair(1u);
  }
  let self_pos_mass = input_state[self_index * 2u];
  let other_pos_mass = input_state[other_index * 2u];
  if (
    self_pos_mass.w <= 0.0
    || other_pos_mass.w <= 0.0
  ) { return mechanical_solver_zero_pair(1u); }
  // The sealed graph admits only mechanically active endpoints, and every
  // row was authenticated before CSR validation compacted this geometry.
  let self_diameter = self_geometry.w;
  let other_diameter = other_geometry.w;
  let rest_distance = 0.5 * (self_diameter + other_diameter);
  let delta = self_pos_mass.xyz - other_pos_mass.xyz;
  var distance_m = length(delta);
  var overlap = max(rest_distance - distance_m, 0.0);
  // Soft liquid relaxation has no swept-impact semantics. Most retained broad
  // edges are currently separated, so reject them before any epoch reads. A
  // coincident pair alone consults the epoch direction as a stable fallback.
  if (!unilateral) {
    if (overlap <= 0.0) { return mechanical_solver_zero_pair(1u); }
    var soft_normal = vec3<f32>(0.0, 1.0, 0.0);
    if (distance_m > 1.0e-9) {
      soft_normal = delta / distance_m;
    } else {
      let soft_epoch_delta = self_geometry.xyz - other_geometry.xyz;
      let soft_epoch_distance = length(soft_epoch_delta);
      soft_normal = select(
        mechanical_solver_coincidence_normal(self_index, other_index),
        soft_epoch_delta / max(soft_epoch_distance, 1.0e-30),
        soft_epoch_distance > 1.0e-9
      );
      distance_m = 0.0;
    }
    return mechanical_solver_pair_response(
      self_index,
      other_index,
      self_pos_mass.w,
      other_pos_mass.w,
      overlap,
      soft_normal,
      soft_normal,
      1.0,
      false,
      include_soft
    );
  }
  let epoch_delta = self_geometry.xyz - other_geometry.xyz;
  let finite_volume_contact = mechanical_solver_finite_volume_contact(
    self_index,
    other_index,
    delta,
    epoch_delta,
    self_diameter,
    other_diameter
  );
  if (finite_volume_contact.admitted == 0u) {
    return mechanical_solver_zero_pair(1u);
  }
  return mechanical_solver_pair_response(
    self_index,
    other_index,
    self_pos_mass.w,
    other_pos_mass.w,
    finite_volume_contact.overlap_m,
    finite_volume_contact.normal,
    finite_volume_contact.response_normal,
    finite_volume_contact.response_projection,
    true,
    include_soft
  );
}

fn mechanical_measure_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 19u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount8}u
    + (iteration - 8u);
}

fn mechanical_solve_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 23u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount8}u
    + (iteration - 8u);
}

fn mechanical_energy_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 32u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .energyMeasureCount4}u + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .energyMeasureCount8}u + (iteration - 8u);
}

fn mechanical_pre_solve_position_residual_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxPositionResidualOrderedF32_0}u + iteration;
}

fn mechanical_pre_solve_position_violation_ratio_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxPositionViolationRatioOrderedF32_0}u + iteration;
}

fn mechanical_pre_solve_velocity_residual_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxVelocityResidualOrderedF32_0}u + iteration;
}

fn mechanical_iteration_stage_bit(iteration: u32) -> u32 {
  if (iteration < 4u) { return 1u << (6u + iteration); }
  if (iteration < 8u) { return 1u << (18u + iteration - 4u); }
  return ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATIONS_8_15}u;
}

fn mechanical_energy_iteration_stage_bit(iteration: u32) -> u32 {
  if (iteration < 4u) { return 1u << (13u + iteration); }
  if (iteration < 8u) { return 1u << (22u + iteration - 4u); }
  return ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
    .ENERGY_ITERATIONS_8_15}u;
}

fn mechanical_solver_wall_projection_bound_for_diameter(
  self_index: u32,
  diameter_m: f32
) -> f32 {
  let position = input_state[self_index * 2u].xyz;
  var clearance = 0.5 * diameter_m;
  if (mechanical_params.grid_spacing_m > 0.0) {
    clearance = min(clearance, 0.5 * mechanical_params.grid_spacing_m);
  }
  let min_dimension = min(
    mechanical_params.box_dims_m.x,
    min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
  );
  if (min_dimension > 0.0) {
    clearance = min(clearance, 0.49 * min_dimension);
  }
  let lower = vec3<f32>(clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  return length(clamp(position, lower, upper) - position);
}

fn mechanical_solver_wall_projection_bound(self_index: u32) -> f32 {
  let volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  return mechanical_solver_wall_projection_bound_for_diameter(
    self_index,
    mechanical_solver_cbrt(volume)
  );
}

fn mechanical_measure_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let previous_iteration = select(0u, iteration - 1u, iteration > 0u);
  let previous_energy_ready = iteration > 0u
    && atomicLoad(
      &graph_control[mechanical_energy_count_word(previous_iteration)]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & mechanical_energy_iteration_stage_bit(previous_iteration)
    ) != 0u;
  let prior_ready = select(
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u])
          & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      ) != 0u,
    previous_energy_ready,
    iteration > 0u
  );
  if (!prior_ready || atomicLoad(&graph_control[14u]) != 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_jacobi_cache_header_valid()) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index)) {
    particle_scales[self_index] = vec4<f32>(1.0);
    atomicAdd(
      &graph_control[mechanical_measure_count_word(iteration)],
      1u
    );
    if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let self_geometry = mechanical_solver_jacobi_geometry(self_index);
  let self_mass = input_state[self_index * 2u].w;
  if (!mechanical_solver_jacobi_geometry_valid(self_geometry)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  var barrier_dx_triangle_sum_m = 0.0;
  var soft_dx_triangle_sum_m = 0.0;
  var position_dx_sum_m = vec3<f32>(0.0);
  var position_max_pair_dx_m = 0.0;
  var velocity_tensor_00 = 0.0;
  var velocity_tensor_01 = 0.0;
  var velocity_tensor_02 = 0.0;
  var velocity_tensor_11 = 0.0;
  var velocity_tensor_12 = 0.0;
  var velocity_tensor_22 = 0.0;
  var max_position_residual_m = 0.0;
  var max_position_violation_ratio = 0.0;
  var max_velocity_residual_m_per_s = 0.0;
  let self_diameter_m = self_geometry.w;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    let other_geometry = mechanical_solver_jacobi_geometry(other_index);
    let pair = mechanical_solver_pair(
      self_index,
      other_index,
      include_soft,
      self_geometry,
      other_geometry
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    csr_peers[cursor] = mechanical_solver_encode_measured_peer(
      other_index,
      pair.active_pair != 0u
    );
    if (pair.active_pair == 0u) { continue; }
    if (pair.unilateral == 1u) {
      let rest_distance_m = 0.5 * (
        self_diameter_m
          + other_geometry.w
      );
      let position_tolerance_m = max(
        1.0e-5,
        ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
          * rest_distance_m
      );
      max_position_residual_m = max(
        max_position_residual_m,
        pair.position_residual
      );
      max_position_violation_ratio = max(
        max_position_violation_ratio,
        pair.position_residual / position_tolerance_m
      );
      max_velocity_residual_m_per_s = max(
        max_velocity_residual_m_per_s,
        pair.velocity_residual
      );
    }
    barrier_dx_triangle_sum_m = barrier_dx_triangle_sum_m
      + length(pair.barrier_dx);
    soft_dx_triangle_sum_m = soft_dx_triangle_sum_m
      + length(pair.soft_dx);
    let pair_position_dx_m = pair.barrier_dx + pair.soft_dx;
    position_dx_sum_m = position_dx_sum_m + pair_position_dx_m;
    position_max_pair_dx_m = max(
      position_max_pair_dx_m,
      length(pair_position_dx_m)
    );
    if (dot(pair.velocity_normal, pair.velocity_normal) > 0.5) {
      let other_mass = input_state[other_index * 2u].w;
      let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
      let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
      let inverse_mass_share = self_inverse_mass
        / (self_inverse_mass + other_inverse_mass);
      let direction = pair.velocity_normal;
      velocity_tensor_00 = velocity_tensor_00
        + inverse_mass_share * direction.x * direction.x;
      velocity_tensor_01 = velocity_tensor_01
        + inverse_mass_share * direction.x * direction.y;
      velocity_tensor_02 = velocity_tensor_02
        + inverse_mass_share * direction.x * direction.z;
      velocity_tensor_11 = velocity_tensor_11
        + inverse_mass_share * direction.y * direction.y;
      velocity_tensor_12 = velocity_tensor_12
        + inverse_mass_share * direction.y * direction.z;
      velocity_tensor_22 = velocity_tensor_22
        + inverse_mass_share * direction.z * direction.z;
    }
  }
  let initial_displacement_m = length(
    input_state[self_index * 2u].xyz
      - self_geometry.xyz
  );
  let current_wall_projection_m =
    mechanical_solver_wall_projection_bound_for_diameter(
      self_index,
      self_diameter_m
    );
  let position_trust_capacity_m = select(
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS}.0
      * self_diameter_m
      + 2.0 * initial_displacement_m
      + current_wall_projection_m,
    particle_scales[self_index].z,
    iteration > 0u
  );
  // The graph retains every peer reachable inside this epoch ball. Recompute
  // radial slack from the current iteration state instead of permanently
  // debiting oscillatory path length, while reserving this round's complete
  // orthogonal wall projection.
  let remaining_position_trust_m = max(
    0.0,
    position_trust_capacity_m
      - initial_displacement_m
      - current_wall_projection_m
  );
  let position_triangle_sum_m = barrier_dx_triangle_sum_m
    + soft_dx_triangle_sum_m;
  let position_sum_length_m = length(position_dx_sum_m);
  let position_degree_scale = select(
    1.0,
    min(
      1.0,
      position_max_pair_dx_m / max(position_sum_length_m, 1.0e-30)
    ),
    position_sum_length_m > 1.0e-12
  );
  // The solve takes min(endpoint scales) for every reciprocal edge. A scale
  // first caps the aggregate row to its strongest individual constraint, so a
  // degree-four bed cannot multiply its correction. Reciprocal endpoint minima
  // can disturb vector cancellation, so an independent triangle-sum cap proves
  // the realized row cannot exceed remaining complete-solve trust. Energy
  // allocation debits that realized motion before the next measure.
  let position_trust_scale = select(
    position_degree_scale,
    min(
      position_degree_scale,
      remaining_position_trust_m / max(position_triangle_sum_m, 1.0e-30)
    ),
    position_triangle_sum_m > 1.0e-12
  );
  // Each reciprocal pair uses min(endpoint scales). The symmetric tensor is
  // the diagonal block row's inverse-mass-weighted sum of response projectors.
  // It is positive semidefinite, so its trace is a coordinate-invariant upper
  // bound on the largest eigenvalue and is exact for one rank-one contact.
  // Reciprocal pair impulses form a graph Laplacian with equal off-diagonal
  // neighbour blocks, so the complete block-row bound is twice the diagonal
  // tensor bound. Omitting that second half admits the equal-mass contact-sheet
  // mode alpha*lambda=2, whose Jacobi eigenvalue is exactly -1.
  // Do not additionally cap velocity by max-pair / length(row sum): that
  // legacy single-vector trust bound throttles valid multi-contact rows even
  // when the tensor proves their combined reciprocal impulse is stable.
  // Position retains its triangle-sum trust certificate independently.
  let velocity_operator_bound =
    velocity_tensor_00 + velocity_tensor_11 + velocity_tensor_22;
  let velocity_stability_scale = 1.0 / max(
    ${SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR}.0
      * velocity_operator_bound,
    1.0
  );
  let scale = vec4<f32>(
    position_trust_scale,
    velocity_stability_scale,
    position_trust_capacity_m,
    remaining_position_trust_m
  );
  if (
    !mechanical_solver_finite(initial_displacement_m)
    || !mechanical_solver_finite(current_wall_projection_m)
    || !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(remaining_position_trust_m)
    || !mechanical_solver_finite(position_sum_length_m)
    || !mechanical_solver_finite(position_max_pair_dx_m)
    || !mechanical_solver_finite(position_degree_scale)
    || position_trust_scale < 0.0
    || position_trust_scale > 1.0
    || velocity_stability_scale < 0.0
    || velocity_stability_scale > 1.0
    || position_trust_capacity_m < 0.0
    || remaining_position_trust_m < 0.0
    || remaining_position_trust_m > position_trust_capacity_m
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  atomicMax(
    &graph_control[mechanical_pre_solve_position_residual_word(iteration)],
    bitcast<u32>(max_position_residual_m)
  );
  atomicMax(
    &graph_control[
      mechanical_pre_solve_position_violation_ratio_word(iteration)
    ],
    bitcast<u32>(max_position_violation_ratio)
  );
  atomicMax(
    &graph_control[mechanical_pre_solve_velocity_residual_word(iteration)],
    bitcast<u32>(max_velocity_residual_m_per_s)
  );
  particle_scales[self_index] = scale;
  atomicAdd(
    &graph_control[mechanical_measure_count_word(iteration)],
    1u
  );
  if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
}

fn mechanical_solver_pair_scale(
  self_index: u32,
  other_index: u32
) -> vec4<f32> {
  let self_scale = particle_scales[self_index];
  let other_scale = particle_scales[other_index];
  let position_scale = min(self_scale.x, other_scale.x);
  let velocity_scale = min(self_scale.y, other_scale.y);
  // A swept finite-volume projection is conservative only while its central
  // position rollback and impulse retain the same scalar multiplier. Use the
  // stricter of the independently proven trust/stability factors for both;
  // this remains inside each bound and preserves Δr = Δt·Δu.
  let coupled_scale = min(position_scale, velocity_scale);
  return vec4<f32>(
    coupled_scale,
    coupled_scale,
    coupled_scale,
    coupled_scale
  );
}

fn mechanical_energy_base(index: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
    + index * 2u;
}

struct MechanicalEdgeLinearLoss {
  loss_j: f32,
  valid: u32,
};

fn mechanical_edge_linear_loss_from_pair_dv(
  low_index: u32,
  high_index: u32,
  low_pair_dv: vec3<f32>,
  high_pair_dv: vec3<f32>
) -> MechanicalEdgeLinearLoss {
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  let low_momentum_delta = low_pos_mass.w * low_pair_dv;
  let high_momentum_delta = high_pos_mass.w * high_pair_dv;
  let momentum_conditioning = length(low_momentum_delta)
    + length(high_momentum_delta);
  let momentum_tolerance = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  if (length(low_momentum_delta + high_momentum_delta)
      > momentum_tolerance) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let canonical_pair_momentum_delta = 0.5 * (
    low_momentum_delta - high_momentum_delta
  );
  let relative_linear_work_j = dot(
    input_state[low_index * 2u + 1u].xyz
      - input_state[high_index * 2u + 1u].xyz,
    canonical_pair_momentum_delta
  );
  let work_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(abs(relative_linear_work_j), 1.0)
  );
  if (!mechanical_solver_finite(relative_linear_work_j)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  if (relative_linear_work_j > work_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return MechanicalEdgeLinearLoss(max(0.0, -relative_linear_work_j), 1u);
}

fn mechanical_solve_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let energy_base = mechanical_energy_base(self_index);
  energy_ledger[energy_base] = vec4<f32>(0.0);
  if (iteration == 0u) {
    energy_ledger[energy_base + 1u] = vec4<f32>(0.0, 0.0, 0.0, vel_u.w);
  }
  output_state[self_index * 2u] = pos_mass;
  output_state[self_index * 2u + 1u] = vel_u;
  if (
    atomicLoad(&graph_control[mechanical_measure_count_word(iteration)])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_jacobi_cache_header_valid()) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index) || pos_mass.w <= 0.0) {
    atomicAdd(
      &graph_control[mechanical_solve_count_word(iteration)],
      1u
    );
    if (self_index == 0u) {
      atomicAdd(&traversal_evidence[29u], 1u);
      atomicOr(
        &graph_control[15u],
        mechanical_iteration_stage_bit(iteration)
      );
    }
    return;
  }
  let self_geometry = mechanical_solver_jacobi_geometry(self_index);
  if (!mechanical_solver_jacobi_geometry_valid(self_geometry)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var dx = vec3<f32>(0.0);
  var dv = vec3<f32>(0.0);
  var half_linear_loss_budget_j = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
    let other_index = mechanical_solver_peer_index(encoded_peer);
    let other_geometry = mechanical_solver_jacobi_geometry(other_index);
    let pair = mechanical_solver_pair(
      self_index,
      other_index,
      include_soft,
      self_geometry,
      other_geometry
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
    let self_pair_dv = pair_scale.y * pair.barrier_dv
      + pair_scale.w * pair.soft_dv;
    // The reciprocal pair uses the same symmetric scale and opposite normal.
    // Derive its velocity delta from exact pair-momentum closure instead of
    // evaluating the full swept contact law a second time. This preserves the
    // unequal-mass response while removing one expensive pair-law evaluation
    // for every directed edge in every solver round.
    let other_mass = input_state[other_index * 2u].w;
    if (!(other_mass > 0.0)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let other_pair_dv = -(pos_mass.w / other_mass) * self_pair_dv;
    if (!mechanical_solver_finite3(other_pair_dv)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let low_index = min(self_index, other_index);
    let high_index = max(self_index, other_index);
    let low_pair_dv = select(other_pair_dv, self_pair_dv, self_index == low_index);
    let high_pair_dv = select(self_pair_dv, other_pair_dv, self_index == low_index);
    let edge = mechanical_edge_linear_loss_from_pair_dv(
      low_index,
      high_index,
      low_pair_dv,
      high_pair_dv
    );
    if (edge.valid == 0u) { return; }
    half_linear_loss_budget_j = half_linear_loss_budget_j
      + 0.5 * edge.loss_j;
    dx = dx
      + pair_scale.x * pair.barrier_dx
      + pair_scale.z * pair.soft_dx;
    dv = dv + self_pair_dv;
  }
  var position = pos_mass.xyz + dx;
  let contact_velocity = vel_u.xyz + dv;
  var velocity = contact_velocity;
  var wall_clearance = 0.0;
  let self_diameter_m = self_geometry.w;
  if (self_diameter_m > 0.0) {
    wall_clearance = 0.5 * self_diameter_m;
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(
        mechanical_params.box_dims_m.y,
        mechanical_params.box_dims_m.z
      )
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let upper = max(
    vec3<f32>(wall_clearance),
    mechanical_params.box_dims_m - vec3<f32>(wall_clearance)
  );
  let lower = vec3<f32>(wall_clearance);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (position.x < wall_clearance) {
    position.x = wall_clearance;
  } else if (position.x > upper.x) {
    position.x = upper.x;
  }
  if (position.y < wall_clearance) {
    position.y = wall_clearance;
  } else if (position.y > upper.y) {
    position.y = upper.y;
  }
  if (position.z < wall_clearance) {
    position.z = wall_clearance;
  } else if (position.z > upper.z) {
    position.z = upper.z;
  }
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) { velocity.x = 0.0; }
  if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) { velocity.x = 0.0; }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) { velocity.y = 0.0; }
  if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) { velocity.y = 0.0; }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) { velocity.z = 0.0; }
  if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) { velocity.z = 0.0; }
  if (!mechanical_solver_finite3(position) || !mechanical_solver_finite3(velocity)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(contact_velocity, contact_velocity)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(contact_velocity, contact_velocity)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || wall_kinetic_delta_j > wall_tolerance_j
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  let quadratic_energy_j = 0.5 * max(pos_mass.w, 0.0) * dot(dv, dv);
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let budget_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(
      quadratic_energy_j + half_linear_loss_budget_j,
      1.0
    )
  );
  if (
    !mechanical_solver_finite(quadratic_energy_j)
    || !mechanical_solver_finite(half_linear_loss_budget_j)
    || !mechanical_solver_finite(wall_heat_j)
    || quadratic_energy_j
      > half_linear_loss_budget_j + budget_tolerance_j
    || wall_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(quadratic_energy_j)
          && mechanical_solver_finite(half_linear_loss_budget_j)
          && quadratic_energy_j
            > half_linear_loss_budget_j + budget_tolerance_j
      )
    );
    if (quadratic_energy_j > half_linear_loss_budget_j + budget_tolerance_j) {
      atomicAdd(&traversal_evidence[38u], 1u);
    }
    return;
  }
  let quadratic_budget_fraction = select(
    0.0,
    clamp(
      quadratic_energy_j / max(half_linear_loss_budget_j, 1.0e-30),
      0.0,
      1.0
    ),
    half_linear_loss_budget_j > 0.0
  );
  energy_ledger[energy_base] = vec4<f32>(
    quadratic_budget_fraction,
    quadratic_energy_j,
    half_linear_loss_budget_j,
    wall_heat_j
  );
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
  atomicAdd(
    &graph_control[mechanical_solve_count_word(iteration)],
    1u
  );
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[29u], 1u);
    atomicOr(
      &graph_control[15u],
      mechanical_iteration_stage_bit(iteration)
    );
  }
}

fn mechanical_energy_effective_pair_dv(
  self_index: u32,
  other_index: u32,
  include_soft: bool,
  self_geometry: vec4<f32>,
  other_geometry: vec4<f32>
) -> vec3<f32> {
  let pair = mechanical_solver_pair(
    self_index,
    other_index,
    include_soft,
    self_geometry,
    other_geometry
  );
  if (pair.valid == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return vec3<f32>(0.0);
  }
  let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
  return pair_scale.y * pair.barrier_dv
    + pair_scale.w * pair.soft_dv;
}

fn mechanical_edge_linear_loss(
  low_index: u32,
  high_index: u32,
  include_soft: bool,
  low_geometry: vec4<f32>,
  high_geometry: vec4<f32>
) -> MechanicalEdgeLinearLoss {
  let low_pair_dv = mechanical_energy_effective_pair_dv(
    low_index,
    high_index,
    include_soft,
    low_geometry,
    high_geometry
  );
  if (atomicLoad(&graph_control[14u]) != 0u) {
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let low_mass = input_state[low_index * 2u].w;
  let high_mass = input_state[high_index * 2u].w;
  if (!(low_mass > 0.0) || !(high_mass > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  // The directed graph is reciprocal and the pair scale is symmetric. Derive
  // the reverse endpoint response from momentum conservation instead of
  // running the swept pair law again during energy allocation.
  let high_pair_dv = -(low_mass / high_mass) * low_pair_dv;
  if (!mechanical_solver_finite3(high_pair_dv)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return mechanical_edge_linear_loss_from_pair_dv(
    low_index,
    high_index,
    low_pair_dv,
    high_pair_dv
  );
}

fn mechanical_allocate_energy_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  if (
    atomicLoad(&graph_control[mechanical_solve_count_word(iteration)])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_jacobi_cache_header_valid()) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let energy_base = mechanical_energy_base(self_index);
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let self_geometry = mechanical_solver_jacobi_geometry(self_index);
  if (!mechanical_solver_jacobi_geometry_valid(self_geometry)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let budget = energy_ledger[energy_base];
  var cumulative = energy_ledger[energy_base + 1u];
  var linear_loss_share_j = 0.0;
  var pair_heat_j = 0.0;
  var realized_position_dx_m = vec3<f32>(0.0);
  if (mechanical_solver_selected(self_index) && pos_mass.w > 0.0) {
    let begin = source_offsets[self_index];
    let end = source_offsets[self_index + 1u];
    let total = atomicLoad(&graph_control[12u]);
    if (begin > end || end > total) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      return;
    }
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      let encoded_peer = csr_peers[cursor];
      if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
      let peer_index = mechanical_solver_peer_index(encoded_peer);
      let peer_geometry = mechanical_solver_jacobi_geometry(peer_index);
      let self_pair = mechanical_solver_pair(
        self_index,
        peer_index,
        include_soft,
        self_geometry,
        peer_geometry
      );
      if (self_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (self_pair.active_pair == 0u) { continue; }
      let self_pair_scale = mechanical_solver_pair_scale(
        self_index,
        peer_index
      );
      realized_position_dx_m = realized_position_dx_m
        + self_pair_scale.x * self_pair.barrier_dx
        + self_pair_scale.z * self_pair.soft_dx;
      let low_index = min(self_index, peer_index);
      let high_index = max(self_index, peer_index);
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      var low_geometry = self_geometry;
      var high_geometry = peer_geometry;
      if (self_index != low_index) {
        low_geometry = peer_geometry;
        high_geometry = self_geometry;
      }
      let edge = mechanical_edge_linear_loss(
        low_index,
        high_index,
        include_soft,
        low_geometry,
        high_geometry
      );
      if (edge.valid == 0u) { return; }
      let edge_heat_fraction = max(
        0.0,
        1.0 - 0.5 * (
          energy_ledger[mechanical_energy_base(low_index)].x
            + energy_ledger[mechanical_energy_base(high_index)].x
        )
      );
      let edge_heat_j = edge.loss_j * edge_heat_fraction;
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = select(
        0.5,
        low_pos_mass.w / pair_mass,
        pair_mass > 0.0
      );
      let self_mass_fraction = select(
        1.0 - low_mass_fraction,
        low_mass_fraction,
        self_index == low_index
      );
      linear_loss_share_j = linear_loss_share_j
        + edge.loss_j * self_mass_fraction;
      pair_heat_j = pair_heat_j + edge_heat_j * self_mass_fraction;
    }
  }
  let position_trust_capacity_m = particle_scales[self_index].z;
  let prior_position_trust_m = particle_scales[self_index].w;
  let spent_position_trust_m = length(realized_position_dx_m);
  let next_epoch_displacement_m = length(
    output_state[self_index * 2u].xyz - self_geometry.xyz
  );
  let position_trust_tolerance = max(
    ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M},
    ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER}.0
      * 1.1920929e-7 * max(position_trust_capacity_m, 1.0)
  );
  if (
    !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(prior_position_trust_m)
    || !mechanical_solver_finite(spent_position_trust_m)
    || !mechanical_solver_finite(next_epoch_displacement_m)
    || position_trust_capacity_m < 0.0
    || prior_position_trust_m < 0.0
    || prior_position_trust_m > position_trust_capacity_m
    || spent_position_trust_m
      > prior_position_trust_m + position_trust_tolerance
    || next_epoch_displacement_m
      > position_trust_capacity_m + position_trust_tolerance
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let remaining_position_trust_m = max(
    0.0,
    position_trust_capacity_m - next_epoch_displacement_m
  );
  let pair_delta_k_j = budget.y - linear_loss_share_j;
  let wall_heat_j = budget.w;
  let cumulative_heat_j = cumulative.y + cumulative.z
    + pair_heat_j + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w + cumulative_heat_j / pos_mass.w,
    pos_mass.w > 0.0
  );
  // Contact only dissipates (heat >= 0), so u may not fall below its
  // step-start value. A sign test on u itself is gauge-dependent: the
  // phase-caloric (IAPWS-style) water gauge gives ice u < 0.
  let start_u = select(vel_u.w, cumulative.w, pos_mass.w > 0.0);
  if (
    !mechanical_solver_finite(pair_delta_k_j)
    || !mechanical_solver_finite(pair_heat_j)
    || !mechanical_solver_finite(wall_heat_j)
    || !mechanical_solver_finite(next_u)
    || pair_heat_j < 0.0
    || wall_heat_j < 0.0
    || next_u < start_u
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NEGATIVE_INTERNAL_ENERGY}u,
        mechanical_solver_finite(next_u) && next_u < start_u
      )
    );
    if (mechanical_solver_finite(next_u) && next_u < start_u) {
      atomicAdd(&traversal_evidence[39u], 1u);
    }
    return;
  }
  let committed_velocity = output_state[self_index * 2u + 1u];
  output_state[self_index * 2u + 1u] = vec4<f32>(
    committed_velocity.xyz,
    next_u
  );
  cumulative = vec4<f32>(
    cumulative.x + pair_delta_k_j,
    cumulative.y + pair_heat_j,
    cumulative.z + wall_heat_j,
    cumulative.w
  );
  energy_ledger[energy_base + 1u] = cumulative;
  // Lanes z/w carry the epoch-ball certificate through the deterministic
  // conflict-free cleanup that follows the Jacobi warm start. A dedicated
  // terminal pass restores the public four-scale row before verification.
  particle_scales[self_index].z = position_trust_capacity_m;
  particle_scales[self_index].w = remaining_position_trust_m;
  atomicAdd(
    &graph_control[mechanical_energy_count_word(iteration)],
    1u
  );
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[32u], 1u);
    atomicOr(
      &graph_control[15u],
      mechanical_energy_iteration_stage_bit(iteration)
    );
  }
}

var<workgroup> mechanical_energy_totals: array<vec4<f32>, 64>;
var<workgroup> mechanical_energy_error_bounds: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn verify_contact_energy(
  @builtin(local_invocation_index) local_index: u32
) {
  // This entry point has workgroup barriers, so every lane must still take
  // the same barrier path when the authenticated zero-edge path is selected.
  // Keep its reduction inert instead of returning before those barriers.
  let full_solver_path = mechanical_solver_full_path_enabled();
  var energy_stages_ready = full_solver_path;
  for (var iteration = 0u;
    iteration < mechanical_params.solver_iteration_count;
    iteration = iteration + 1u) {
    energy_stages_ready = energy_stages_ready
      && atomicLoad(&graph_control[mechanical_energy_count_word(iteration)])
        == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u])
          & mechanical_energy_iteration_stage_bit(iteration)
      ) != 0u;
  }
  energy_stages_ready = energy_stages_ready
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) == ${solverBudget.cleanupPassBudget}u
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) != 0u
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
          .MATCHING_TRUST_RESTORED}u
    ) != 0u;
  let prior_failure = atomicLoad(&graph_control[14u]) != 0u;
  let energy_admitted = full_solver_path && energy_stages_ready && !prior_failure;
  var totals = vec4<f32>(0.0);
  var error_bounds = vec4<f32>(0.0);
  if (energy_admitted) {
    for (var index = local_index; index < mechanical_params.particle_count;
      index = index + 64u) {
    let ledger = energy_ledger[mechanical_energy_base(index) + 1u];
    let state = input_state[index * 2u];
    let final_u = input_state[index * 2u + 1u].w;
    if (!all(vec4<bool>(
      mechanical_solver_finite(ledger.x),
      mechanical_solver_finite(ledger.y),
      mechanical_solver_finite(ledger.z),
      mechanical_solver_finite(ledger.w)
    )) || !mechanical_solver_finite(final_u)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      continue;
    }
    let row_internal_delta_j = state.w * (final_u - ledger.w);
    let row_intended_transfer_j = ledger.y + ledger.z;
    let row_storage_rounding_bound_j = max(
      1.0e-6,
      0.5 * 1.1920929e-7
        * max(state.w, 0.0)
        * max(max(abs(final_u), abs(ledger.w)), 1.0)
        + 16.0 * 1.1920929e-7
          * max(abs(row_intended_transfer_j), 1.0)
    );
    if (abs(row_internal_delta_j - row_intended_transfer_j)
        > row_storage_rounding_bound_j) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
      );
      continue;
    }
    totals = totals + vec4<f32>(
      ledger.x,
      ledger.y,
      ledger.z,
      row_internal_delta_j
    );
    let pair_conditioning_j = abs(ledger.x) + abs(ledger.y);
    let conditioning_j = abs(ledger.x)
      + abs(ledger.y)
      + ledger.z
      + abs(row_internal_delta_j);
      error_bounds = error_bounds + vec4<f32>(
        conditioning_j,
        pair_conditioning_j,
        row_storage_rounding_bound_j,
        0.0
      );
    }
  }
  mechanical_energy_totals[local_index] = totals;
  mechanical_energy_error_bounds[local_index] = error_bounds;
  workgroupBarrier();
  for (var offset = 32u; offset > 0u; offset = offset / 2u) {
    if (local_index < offset) {
      mechanical_energy_totals[local_index] =
        mechanical_energy_totals[local_index]
          + mechanical_energy_totals[local_index + offset];
      mechanical_energy_error_bounds[local_index] =
        mechanical_energy_error_bounds[local_index]
          + mechanical_energy_error_bounds[local_index + offset];
    }
    workgroupBarrier();
  }
  if (local_index != 0u) { return; }
  if (!full_solver_path) { return; }
  if (!energy_stages_ready) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (prior_failure || atomicLoad(&graph_control[14u]) != 0u) { return; }
  let pair_delta_k_j = mechanical_energy_totals[0u].x;
  let pair_heat_j = mechanical_energy_totals[0u].y;
  let wall_heat_j = mechanical_energy_totals[0u].z;
  let internal_energy_delta_j = mechanical_energy_totals[0u].w;
  let conditioning_j = mechanical_energy_error_bounds[0u].x;
  let pair_conditioning_j = mechanical_energy_error_bounds[0u].y;
  let internal_storage_rounding_bound_j =
    mechanical_energy_error_bounds[0u].z;
  let pair_residual_j = pair_delta_k_j + pair_heat_j;
  let internal_residual_j = internal_energy_delta_j
    - pair_heat_j
    - wall_heat_j;
  let residual_j = max(abs(pair_residual_j), abs(internal_residual_j));
  let tolerance_j = max(
    max(
      1.0e-4,
      256.0 * 1.1920929e-7 * max(conditioning_j, 1.0)
    ),
    internal_storage_rounding_bound_j
  );
  let pair_gain_tolerance_j = max(
    1.0e-5,
    128.0 * 1.1920929e-7 * max(pair_conditioning_j, 1.0)
  );
  atomicStore(&graph_control[36u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&graph_control[37u], bitcast<u32>(pair_heat_j));
  atomicStore(&graph_control[38u], bitcast<u32>(wall_heat_j));
  atomicStore(&graph_control[39u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[33u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&traversal_evidence[34u], bitcast<u32>(pair_heat_j));
  atomicStore(&traversal_evidence[35u], bitcast<u32>(wall_heat_j));
  atomicStore(&traversal_evidence[36u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[37u], bitcast<u32>(tolerance_j));
  if (pair_delta_k_j > pair_gain_tolerance_j
      || pair_heat_j < -pair_gain_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  if (!mechanical_solver_finite(residual_j)
      || !mechanical_solver_finite(tolerance_j)
      || residual_j > tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return;
  }
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
  );
}

fn mechanical_runtime_iteration_valid(iteration: u32) -> bool {
  return iteration < mechanical_params.solver_iteration_count
    && iteration < ${solverBudget.jacobiIterations}u;
}

@compute @workgroup_size(64)
fn measure_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_measure_iteration(global_id.x, iteration, iteration == 0u);
}

@compute @workgroup_size(64)
fn solve_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_solve_iteration(global_id.x, iteration, iteration == 0u);
}

@compute @workgroup_size(64)
fn allocate_energy_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_allocate_energy_iteration(
    global_id.x,
    iteration,
    iteration == 0u
  );
}

fn mechanical_matching_cleanup_header_valid() -> bool {
  return arrayLength(&traversal_evidence)
      >= ${solverBudget.matchingCleanupControlWords}u
    && atomicLoad(&traversal_evidence[0u])
      == ${MATCHING_CLEANUP_CONTROL_MAGIC}u
    && atomicLoad(&traversal_evidence[1u])
      == ${MATCHING_CLEANUP_CONTROL_VERSION}u
    && atomicLoad(&traversal_evidence[2u])
      == mechanical_params.generation_id
    && atomicLoad(&traversal_evidence[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&traversal_evidence[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&traversal_evidence[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&traversal_evidence[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&traversal_evidence[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&traversal_evidence[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&traversal_evidence[9u])
      == mechanical_params.particle_count
    && atomicLoad(&traversal_evidence[10u])
      == mechanical_params.solver_iteration_count
    && atomicLoad(&traversal_evidence[11u])
      == ${solverBudget.cleanupPassBudget}u;
}

fn mechanical_matching_selection_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.selectionCountWord}u + pass_index;
}

fn mechanical_matching_copy_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.copyCountWord}u + pass_index;
}

fn mechanical_matching_apply_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.applyCountWord}u + pass_index;
}

fn mechanical_matching_wall_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.wallCountWord}u + pass_index;
}

fn mechanical_matching_applied_pair_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.appliedPairCountWord}u + pass_index;
}

fn mechanical_matching_max_position_ratio_word(pass_index: u32) -> u32 {
  return ${solverBudget.maxPositionRatioWord}u + pass_index;
}

fn mechanical_matching_max_velocity_residual_word(pass_index: u32) -> u32 {
  return ${solverBudget.maxVelocityResidualWord}u + pass_index;
}

fn mechanical_matching_contact_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.contactCountWord}u + pass_index;
}

fn mechanical_matching_jacobi_ready() -> bool {
  let final_iteration = mechanical_params.solver_iteration_count - 1u;
  return mechanical_solver_full_path_enabled()
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(
      &graph_control[mechanical_energy_count_word(final_iteration)]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & mechanical_energy_iteration_stage_bit(final_iteration)
    ) != 0u;
}

fn mechanical_matching_jacobi_residual_converged() -> bool {
  let final_iteration = mechanical_params.solver_iteration_count - 1u;
  let position_ratio = bitcast<f32>(atomicLoad(
    &graph_control[
      mechanical_pre_solve_position_violation_ratio_word(final_iteration)
    ]
  ));
  let velocity_residual_m_per_s = bitcast<f32>(atomicLoad(
    &graph_control[
      mechanical_pre_solve_velocity_residual_word(final_iteration)
    ]
  ));
  return mechanical_solver_finite(position_ratio)
    && mechanical_solver_finite(velocity_residual_m_per_s)
    && position_ratio <= 1.0
    && velocity_residual_m_per_s <= ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
}

fn mechanical_matching_current_pass() -> u32 {
  return atomicLoad(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupPassCount}u]
  );
}

fn mechanical_matching_prior_applied_pair_count(pass_index: u32) -> u32 {
  if (pass_index == 0u) { return 0u; }
  return atomicLoad(
    &traversal_evidence[
      mechanical_matching_applied_pair_count_word(pass_index - 1u)
    ]
  );
}

fn mechanical_matching_position_tolerance(
  low_index: u32,
  high_index: u32
) -> f32 {
  let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
  let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
  let rest_distance_m = 0.5 * (
    mechanical_solver_cbrt(low_volume)
      + mechanical_solver_cbrt(high_volume)
  );
  return max(
    1.0e-5,
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
      * rest_distance_m
  );
}

fn mechanical_matching_edge_rank(low_index: u32, high_index: u32) -> u32 {
  var rank = (low_index * 2654435761u)
    ^ (high_index * 2246822519u)
    ^ 0x9e3779b9u;
  rank = (rank ^ (rank >> 16u)) * 2246822519u;
  rank = (rank ^ (rank >> 13u)) * 3266489917u;
  return rank ^ (rank >> 16u);
}

fn mechanical_matching_constraint_code(normal: vec3<f32>) -> f32 {
  var axis = 0u;
  if (abs(normal.y) > abs(normal.x)) { axis = 1u; }
  if (
    abs(normal.z)
      > select(abs(normal.x), abs(normal.y), axis == 1u)
  ) { axis = 2u; }
  let component = select(
    normal.x,
    select(normal.y, normal.z, axis == 2u),
    axis != 0u
  );
  let sign_code = select(0u, 1u, component >= 0.0);
  return f32(1u + 2u * axis + sign_code);
}

fn mechanical_matching_constraint_code_valid(constraint: vec4<f32>) -> bool {
  let code = abs(constraint.w);
  return mechanical_solver_finite(code)
    && code >= 1.0
    && code <= 6.0
    && code == floor(code);
}

fn mechanical_matching_constraint_normal(
  constraint: vec4<f32>
) -> vec3<f32> {
  let encoded = u32(abs(constraint.w)) - 1u;
  let axis = encoded / 2u;
  let sign = select(-1.0, 1.0, (encoded & 1u) != 0u);
  var normal = vec3<f32>(0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }
  return normal;
}

fn mechanical_matching_constraint_face_active(
  current_delta: vec3<f32>,
  low_edge_m: f32,
  high_edge_m: f32,
  constraint_normal: vec3<f32>
) -> bool {
  let half_sum_m = 0.5 * (low_edge_m + high_edge_m);
  var normal_axis = 0u;
  if (abs(constraint_normal.y) > abs(constraint_normal.x)) {
    normal_axis = 1u;
  }
  if (
    abs(constraint_normal.z)
      > select(
        abs(constraint_normal.x),
        abs(constraint_normal.y),
        normal_axis == 1u
      )
  ) {
    normal_axis = 2u;
  }
  var tangent_a_m = current_delta.y;
  var tangent_b_m = current_delta.z;
  if (normal_axis == 1u) {
    tangent_a_m = current_delta.x;
    tangent_b_m = current_delta.z;
  } else if (normal_axis == 2u) {
    tangent_a_m = current_delta.x;
    tangent_b_m = current_delta.y;
  }
  let tangent_zero_tolerance_m =
    mechanical_solver_aabb_tangent_zero_tolerance_m(
      current_delta,
      low_edge_m,
      high_edge_m
    );
  return dot(current_delta, constraint_normal)
      <= half_sum_m
        + mechanical_solver_aabb_normal_roundoff_tolerance_m(
          current_delta,
          low_edge_m,
          high_edge_m
        )
    && half_sum_m - abs(tangent_a_m) > tangent_zero_tolerance_m
    && half_sum_m - abs(tangent_b_m) > tangent_zero_tolerance_m;
}

fn mechanical_matching_positive_constraint_swept_active(
  low_index: u32,
  high_index: u32,
  current_delta: vec3<f32>,
  low_edge_m: f32,
  high_edge_m: f32,
  constraint_normal: vec3<f32>
) -> bool {
  let epoch_delta = mechanical_solver_epoch_position(low_index)
    - mechanical_solver_epoch_position(high_index);
  let swept_contact = mechanical_solver_finite_volume_contact(
    low_index,
    high_index,
    current_delta,
    epoch_delta,
    low_edge_m,
    high_edge_m
  );
  return swept_contact.admitted != 0u
    && swept_contact.swept_contact != 0u
    && dot(swept_contact.normal, constraint_normal) > 1.0 - 1.0e-6;
}

fn mechanical_matching_separating_normal(
  low_index: u32,
  high_index: u32,
  current_delta: vec3<f32>
) -> vec3<f32> {
  let coincidence_normal = mechanical_solver_coincidence_normal(
    low_index,
    high_index
  );
  let source = select(
    coincidence_normal,
    current_delta,
    length(current_delta) > 1.0e-12
  );
  var axis = 0u;
  if (abs(source.y) > abs(source.x)) { axis = 1u; }
  if (
    abs(source.z)
      > select(abs(source.x), abs(source.y), axis == 1u)
  ) { axis = 2u; }
  let component = select(
    source.x,
    select(source.y, source.z, axis == 2u),
    axis != 0u
  );
  let sign = select(-1.0, 1.0, component >= 0.0);
  var normal = vec3<f32>(0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }
  return normal;
}

fn mechanical_matching_constraint_pair(
  low_index: u32,
  high_index: u32,
  constraint_cursor: u32
) -> MechanicalPairResidual {
  let constraint = matching_constraints[constraint_cursor];
  if (all(constraint == vec4<f32>(0.0))) {
    return mechanical_solver_zero_pair(1u);
  }
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
  let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
  if (
    low_pos_mass.w <= 0.0
    || high_pos_mass.w <= 0.0
    || low_volume <= 0.0
    || high_volume <= 0.0
    || !mechanical_solver_finite3(constraint.xyz)
    || !mechanical_matching_constraint_code_valid(constraint)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  let constraint_normal = mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let response_normal_length = length(response_normal);
  let current_delta = low_pos_mass.xyz - high_pos_mass.xyz;
  let low_edge_m = mechanical_solver_cbrt(low_volume);
  let high_edge_m = mechanical_solver_cbrt(high_volume);
  let support_distance_m = 0.5 * (low_edge_m + high_edge_m);
  let overlap_m = max(
    support_distance_m - dot(current_delta, constraint_normal),
    0.0
  );
  if (
    !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite(response_normal_length)
    || abs(response_normal_length - 1.0) > 1.0e-3
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 1.0e-6
    || !mechanical_solver_finite3(current_delta)
    || !mechanical_solver_finite(support_distance_m)
    || !mechanical_solver_finite(overlap_m)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  // Both initially admitted and dormant constraints describe finite faces.
  // Keeping a positive constraint as an infinite halfspace after tangential
  // support is lost produces equal-and-opposite lateral impulses between
  // already-disjoint cells.
  let current_face_active = mechanical_matching_constraint_face_active(
    current_delta,
    low_edge_m,
    high_edge_m,
    constraint_normal
  );
  let positive_swept_face_active = constraint.w > 0.0
    && !current_face_active
    && mechanical_matching_positive_constraint_swept_active(
      low_index,
      high_index,
      current_delta,
      low_edge_m,
      high_edge_m,
      constraint_normal
    );
  if (!current_face_active && !positive_swept_face_active) {
    return mechanical_solver_zero_pair(1u);
  }
  let fixed_pair = mechanical_solver_pair_response(
    low_index,
    high_index,
    low_pos_mass.w,
    high_pos_mass.w,
    overlap_m,
    constraint_normal,
    response_normal,
    response_projection,
    true,
    false
  );
  if (
    fixed_pair.valid == 0u
    || !mechanical_solver_finite3(fixed_pair.barrier_dx)
    || !mechanical_solver_finite3(fixed_pair.barrier_dv)
    || !mechanical_solver_finite(fixed_pair.position_residual)
    || !mechanical_solver_finite(fixed_pair.velocity_residual)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  return fixed_pair;
}

fn mechanical_matching_project_wall_velocity(
  particle_index: u32,
  position: vec3<f32>,
  input_velocity: vec3<f32>,
  mass_kg: f32
) -> MechanicalMatchingWallVelocityProjection {
  var velocity = input_velocity;
  var clipped = 0u;
  let rest_volume = max(
    source_mechanics[particle_index * 8u + 4u].w,
    0.0
  );
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = vec3<f32>(wall_clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) {
    velocity.x = 0.0;
    clipped = 1u;
  } else if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) {
    velocity.x = 0.0;
    clipped = 1u;
  }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) {
    velocity.y = 0.0;
    clipped = 1u;
  } else if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) {
    velocity.y = 0.0;
    clipped = 1u;
  }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) {
    velocity.z = 0.0;
    clipped = 1u;
  } else if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) {
    velocity.z = 0.0;
    clipped = 1u;
  }
  let kinetic_delta_j = 0.5 * mass_kg * (
    dot(velocity, velocity) - dot(input_velocity, input_velocity)
  );
  let kinetic_conditioning_j = 0.5 * mass_kg * (
    dot(velocity, velocity) + dot(input_velocity, input_velocity)
  );
  let kinetic_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0)
  );
  let valid = select(
    0u,
    1u,
    mass_kg > 0.0
      && mechanical_solver_finite3(position)
      && mechanical_solver_finite3(velocity)
      && mechanical_solver_finite(kinetic_delta_j)
      && kinetic_delta_j <= kinetic_tolerance_j
  );
  let failure_code = select(
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
    mechanical_solver_finite(kinetic_delta_j)
      && kinetic_delta_j > kinetic_tolerance_j
  );
  return MechanicalMatchingWallVelocityProjection(
    velocity,
    kinetic_delta_j,
    clipped,
    failure_code,
    valid
  );
}

fn mechanical_matching_relative_velocity_delta(
  relative_velocity: vec3<f32>,
  constraint: vec4<f32>
) -> vec3<f32> {
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let approach_m_per_s = dot(relative_velocity, constraint_normal);
  if (approach_m_per_s >= 0.0) { return vec3<f32>(0.0); }
  var relative_dv =
    -approach_m_per_s
      / max(response_projection, 1.0e-6)
      * response_normal;
  let central_linear_work_speed_squared = dot(
    relative_velocity,
    relative_dv
  );
  let kinetic_delta_speed_squared =
    2.0 * central_linear_work_speed_squared
      + dot(relative_dv, relative_dv);
  let kinetic_tolerance_speed_squared =
    64.0 * 1.1920929e-7
      * max(dot(relative_velocity, relative_velocity), 1.0);
  if (
    central_linear_work_speed_squared > 0.0
    || kinetic_delta_speed_squared > kinetic_tolerance_speed_squared
  ) {
    let radial_dv = max(
      -dot(relative_velocity, response_normal),
      0.0
    ) * response_normal;
    let velocity_after_radial = relative_velocity + radial_dv;
    let face_dv = max(
      -dot(velocity_after_radial, constraint_normal),
      0.0
    ) * constraint_normal;
    relative_dv = radial_dv + face_dv;
  }
  return relative_dv;
}

fn mechanical_matching_refine_wall_velocity_pair(
  low_index: u32,
  high_index: u32,
  low_position: vec3<f32>,
  high_position: vec3<f32>,
  low_initial_velocity: vec3<f32>,
  high_initial_velocity: vec3<f32>,
  low_mass_kg: f32,
  high_mass_kg: f32,
  low_initial_dv: vec3<f32>,
  high_initial_dv: vec3<f32>,
  constraint: vec4<f32>
) -> MechanicalMatchingVelocityRefinement {
  var result = MechanicalMatchingVelocityRefinement(
    low_initial_velocity,
    high_initial_velocity,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0u,
    0u,
    1u
  );
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let pair_mass_kg = low_mass_kg + high_mass_kg;
  if (
    !(low_mass_kg > 0.0)
    || !(high_mass_kg > 0.0)
    || !(pair_mass_kg > 0.0)
    || !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 1.0e-6
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let low_inverse_mass_share = high_mass_kg / pair_mass_kg;
  var low_velocity = low_initial_velocity;
  var high_velocity = high_initial_velocity;
  var prior_wall_clipped = true;
  for (
    var refinement_round = 0u;
    refinement_round
      < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS}u;
    refinement_round = refinement_round + 1u
  ) {
    let relative_velocity = low_velocity - high_velocity;
    let approach_m_per_s = dot(relative_velocity, constraint_normal);
    if (
      refinement_round > 0u
      && (
        !prior_wall_clipped
        || approach_m_per_s >= -${
          SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
            .toExponential(1)
        }
      )
    ) {
      break;
    }
    var low_dv = low_initial_dv;
    var high_dv = high_initial_dv;
    if (refinement_round > 0u) {
      let relative_dv = mechanical_matching_relative_velocity_delta(
        relative_velocity,
        constraint
      );
      low_dv = low_inverse_mass_share * relative_dv;
      high_dv = -(low_mass_kg / high_mass_kg) * low_dv;
    }
    let low_pair_velocity = low_velocity + low_dv;
    let high_pair_velocity = high_velocity + high_dv;
    let pair_momentum_residual =
      low_mass_kg * low_dv + high_mass_kg * high_dv;
    let pair_momentum_conditioning =
      low_mass_kg * length(low_dv)
        + high_mass_kg * length(high_dv);
    let pair_momentum_tolerance = max(
      1.0e-6,
      128.0 * 1.1920929e-7 * max(pair_momentum_conditioning, 1.0)
    );
    let low_pair_kinetic_delta_j = 0.5 * low_mass_kg * (
      dot(low_pair_velocity, low_pair_velocity)
        - dot(low_velocity, low_velocity)
    );
    let high_pair_kinetic_delta_j = 0.5 * high_mass_kg * (
      dot(high_pair_velocity, high_pair_velocity)
        - dot(high_velocity, high_velocity)
    );
    let pair_kinetic_delta_j =
      low_pair_kinetic_delta_j + high_pair_kinetic_delta_j;
    let pair_kinetic_conditioning_j =
      0.5 * low_mass_kg * (
        dot(low_pair_velocity, low_pair_velocity)
          + dot(low_velocity, low_velocity)
      )
      + 0.5 * high_mass_kg * (
        dot(high_pair_velocity, high_pair_velocity)
          + dot(high_velocity, high_velocity)
      );
    let pair_kinetic_tolerance_j = max(
      1.0e-6,
      128.0 * 1.1920929e-7 * max(pair_kinetic_conditioning_j, 1.0)
    );
    if (
      !mechanical_solver_finite3(low_pair_velocity)
      || !mechanical_solver_finite3(high_pair_velocity)
      || !mechanical_solver_finite3(pair_momentum_residual)
      || length(pair_momentum_residual) > pair_momentum_tolerance
      || !mechanical_solver_finite(low_pair_kinetic_delta_j)
      || !mechanical_solver_finite(high_pair_kinetic_delta_j)
      || !mechanical_solver_finite(pair_kinetic_delta_j)
      || pair_kinetic_delta_j > pair_kinetic_tolerance_j
    ) {
      result.failure_code = select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(pair_kinetic_delta_j)
          && pair_kinetic_delta_j > pair_kinetic_tolerance_j
      );
      result.valid = 0u;
      break;
    }
    result.low_pair_kinetic_delta_j =
      result.low_pair_kinetic_delta_j + low_pair_kinetic_delta_j;
    result.high_pair_kinetic_delta_j =
      result.high_pair_kinetic_delta_j + high_pair_kinetic_delta_j;
    result.low_pair_impulse =
      result.low_pair_impulse + low_mass_kg * low_dv;
    result.high_pair_impulse =
      result.high_pair_impulse + high_mass_kg * high_dv;
    let low_wall = mechanical_matching_project_wall_velocity(
      low_index,
      low_position,
      low_pair_velocity,
      low_mass_kg
    );
    let high_wall = mechanical_matching_project_wall_velocity(
      high_index,
      high_position,
      high_pair_velocity,
      high_mass_kg
    );
    if (low_wall.valid == 0u || high_wall.valid == 0u) {
      result.failure_code = select(
        high_wall.failure_code,
        low_wall.failure_code,
        low_wall.valid == 0u
      );
      result.valid = 0u;
      break;
    }
    result.low_wall_kinetic_delta_j =
      result.low_wall_kinetic_delta_j + low_wall.kinetic_delta_j;
    result.high_wall_kinetic_delta_j =
      result.high_wall_kinetic_delta_j + high_wall.kinetic_delta_j;
    low_velocity = low_wall.velocity;
    high_velocity = high_wall.velocity;
    result.round_count = result.round_count + 1u;
    prior_wall_clipped = low_wall.clipped != 0u || high_wall.clipped != 0u;
  }
  result.low_velocity = low_velocity;
  result.high_velocity = high_velocity;
  if (result.valid == 0u) { return result; }
  let aggregate_pair_kinetic_delta_j =
    result.low_pair_kinetic_delta_j
      + result.high_pair_kinetic_delta_j;
  let aggregate_pair_momentum_residual =
    result.low_pair_impulse + result.high_pair_impulse;
  let aggregate_pair_momentum_conditioning =
    length(result.low_pair_impulse) + length(result.high_pair_impulse);
  let aggregate_pair_momentum_tolerance = max(
    1.0e-6,
    128.0 * 1.1920929e-7
      * max(aggregate_pair_momentum_conditioning, 1.0)
  );
  let aggregate_kinetic_conditioning_j =
    0.5 * low_mass_kg * (
      dot(low_initial_velocity, low_initial_velocity)
        + dot(result.low_velocity, result.low_velocity)
    )
    + 0.5 * high_mass_kg * (
      dot(high_initial_velocity, high_initial_velocity)
        + dot(result.high_velocity, result.high_velocity)
    );
  let aggregate_kinetic_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(aggregate_kinetic_conditioning_j, 1.0)
  );
  if (
    result.round_count == 0u
    || !mechanical_solver_finite3(result.low_velocity)
    || !mechanical_solver_finite3(result.high_velocity)
    || !mechanical_solver_finite3(result.low_pair_impulse)
    || !mechanical_solver_finite3(result.high_pair_impulse)
    || !mechanical_solver_finite3(aggregate_pair_momentum_residual)
    || length(aggregate_pair_momentum_residual)
      > aggregate_pair_momentum_tolerance
    || !mechanical_solver_finite(aggregate_pair_kinetic_delta_j)
    || aggregate_pair_kinetic_delta_j > aggregate_kinetic_tolerance_j
    || !mechanical_solver_finite(result.low_wall_kinetic_delta_j)
    || !mechanical_solver_finite(result.high_wall_kinetic_delta_j)
    || result.low_wall_kinetic_delta_j > aggregate_kinetic_tolerance_j
    || result.high_wall_kinetic_delta_j > aggregate_kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      (
        mechanical_solver_finite(aggregate_pair_kinetic_delta_j)
        && aggregate_pair_kinetic_delta_j
          > aggregate_kinetic_tolerance_j
      )
        || (
          mechanical_solver_finite(result.low_wall_kinetic_delta_j)
          && result.low_wall_kinetic_delta_j
            > aggregate_kinetic_tolerance_j
        )
        || (
          mechanical_solver_finite(result.high_wall_kinetic_delta_j)
          && result.high_wall_kinetic_delta_j
            > aggregate_kinetic_tolerance_j
        )
    );
    result.valid = 0u;
  }
  return result;
}

fn mechanical_matching_zero_three_block() ->
  MechanicalMatchingThreeBlockResult {
  return MechanicalMatchingThreeBlockResult(
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    vec3<f32>(0.0),
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0u,
    0u,
    0u,
    0u,
    1u,
    0u,
    0u
  );
}

fn mechanical_matching_center_oriented_vector(
  center_index: u32,
  other_index: u32,
  canonical_vector: vec3<f32>
) -> vec3<f32> {
  return select(
    -canonical_vector,
    canonical_vector,
    center_index == min(center_index, other_index)
  );
}

fn mechanical_matching_axis_wall_constraint(
  particle_index: u32,
  position: vec3<f32>,
  axis_normal: vec3<f32>
) -> MechanicalMatchingAxisWallConstraint {
  var result = MechanicalMatchingAxisWallConstraint(0.0, 0u, 1u);
  if (
    particle_index >= mechanical_params.particle_count
    || !mechanical_solver_finite3(position)
    || !mechanical_solver_finite3(axis_normal)
    || !mechanical_solver_finite3(mechanical_params.box_dims_m)
  ) {
    result.valid = 0u;
    return result;
  }
  var axis = 0u;
  if (abs(axis_normal.y) > abs(axis_normal.x)) { axis = 1u; }
  if (
    abs(axis_normal.z)
      > select(abs(axis_normal.x), abs(axis_normal.y), axis == 1u)
  ) { axis = 2u; }
  let normal_component = select(
    axis_normal.x,
    select(axis_normal.y, axis_normal.z, axis == 2u),
    axis != 0u
  );
  let position_component = select(
    position.x,
    select(position.y, position.z, axis == 2u),
    axis != 0u
  );
  let box_component = select(
    mechanical_params.box_dims_m.x,
    select(
      mechanical_params.box_dims_m.y,
      mechanical_params.box_dims_m.z,
      axis == 2u
    ),
    axis != 0u
  );
  let rest_volume =
    source_mechanics[particle_index * 8u + 4u].w;
  if (
    abs(abs(normal_component) - 1.0) > 1.0e-6
    || !mechanical_solver_finite(position_component)
    || !mechanical_solver_finite(box_component)
    || !mechanical_solver_finite(rest_volume)
    || box_component <= 0.0
    || rest_volume < 0.0
  ) {
    result.valid = 0u;
    return result;
  }
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = wall_clearance;
  let upper = max(lower, box_component - wall_clearance);
  let lower_tolerance_m =
    mechanical_solver_wall_boundary_tolerance_m(lower, upper);
  let upper_tolerance_m =
    mechanical_solver_wall_boundary_tolerance_m(upper, lower);
  let at_lower = position_component <= lower + lower_tolerance_m;
  let at_upper = position_component >= upper - upper_tolerance_m;
  if (at_lower && at_upper) {
    result.valid = 0u;
    return result;
  }
  if (at_lower) {
    result.inward_scalar_sign = normal_component;
    result.geometry_active = 1u;
  } else if (at_upper) {
    result.inward_scalar_sign = -normal_component;
    result.geometry_active = 1u;
  }
  return result;
}

fn mechanical_matching_axis_contact_normal_valid(
  normal: vec3<f32>
) -> bool {
  if (!mechanical_solver_finite3(normal)) { return false; }
  let abs_normal = abs(normal);
  let x_valid =
    abs_normal.x <= 1.0e-6 || abs(abs_normal.x - 1.0) <= 1.0e-6;
  let y_valid =
    abs_normal.y <= 1.0e-6 || abs(abs_normal.y - 1.0) <= 1.0e-6;
  let z_valid =
    abs_normal.z <= 1.0e-6 || abs(abs_normal.z - 1.0) <= 1.0e-6;
  return x_valid
    && y_valid
    && z_valid
    && abs(abs_normal.x + abs_normal.y + abs_normal.z - 1.0)
      <= 1.0e-6;
}

// Materialize the primal velocity of one enumerated scalar active set from its
// connected components. Broadcasting one shared f32 value makes every active
// contact equality bit-identical instead of accepting inverse-mass roundoff
// under a tolerance wider than the public residual certificate.
fn mechanical_matching_three_block_axis_primal(
  primary_wall_fixed: bool,
  center_wall_fixed: bool,
  secondary_wall_fixed: bool,
  primary_contact_active: bool,
  secondary_contact_active: bool,
  masses_kg: vec3<f32>,
  input_u: vec3<f32>
) -> vec3<f32> {
  if (primary_contact_active && secondary_contact_active) {
    if (
      primary_wall_fixed
      || center_wall_fixed
      || secondary_wall_fixed
    ) {
      return vec3<f32>(0.0);
    }
    let shared_u = (
      masses_kg.x * input_u.x
        + masses_kg.y * input_u.y
        + masses_kg.z * input_u.z
    ) / (masses_kg.x + masses_kg.y + masses_kg.z);
    return vec3<f32>(shared_u);
  }
  if (primary_contact_active) {
    let primary_center_u = select(
      (
        masses_kg.x * input_u.x
          + masses_kg.y * input_u.y
      ) / (masses_kg.x + masses_kg.y),
      0.0,
      primary_wall_fixed || center_wall_fixed
    );
    return vec3<f32>(
      primary_center_u,
      primary_center_u,
      select(input_u.z, 0.0, secondary_wall_fixed)
    );
  }
  if (secondary_contact_active) {
    let center_secondary_u = select(
      (
        masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
      ) / (masses_kg.y + masses_kg.z),
      0.0,
      center_wall_fixed || secondary_wall_fixed
    );
    return vec3<f32>(
      select(input_u.x, 0.0, primary_wall_fixed),
      center_secondary_u,
      center_secondary_u
    );
  }
  return vec3<f32>(
    select(input_u.x, 0.0, primary_wall_fixed),
    select(input_u.y, 0.0, center_wall_fixed),
    select(input_u.z, 0.0, secondary_wall_fixed)
  );
}

// Project one Cartesian lane of a three-particle contact block onto its two
// signed contact halfspaces and three box-wall halfspaces. Frozen finite-volume
// faces and box walls are exact coordinate axes, so the full mass-metric cone
// projection is the product of three independent scalar projections.
fn mechanical_matching_three_block_axis_active_set(
  primary_index: u32,
  center_index: u32,
  secondary_index: u32,
  primary_position: vec3<f32>,
  center_position: vec3<f32>,
  secondary_position: vec3<f32>,
  axis_normal: vec3<f32>,
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  primary_mass_kg: f32,
  center_mass_kg: f32,
  secondary_mass_kg: f32,
  primary_u: f32,
  center_u: f32,
  secondary_u: f32,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingAxisActiveSetResult {
  var result = MechanicalMatchingAxisActiveSetResult(
    primary_u,
    center_u,
    secondary_u,
    0.0,
    0.0,
    0u,
    0u
  );
  let primary_sign_valid =
    abs(primary_contact_sign) <= 1.0e-6
      || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid =
    abs(secondary_contact_sign) <= 1.0e-6
      || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !mechanical_solver_finite(primary_mass_kg)
    || !mechanical_solver_finite(center_mass_kg)
    || !mechanical_solver_finite(secondary_mass_kg)
    || !(primary_mass_kg > 0.0)
    || !(center_mass_kg > 0.0)
    || !(secondary_mass_kg > 0.0)
    || !mechanical_solver_finite(primary_u)
    || !mechanical_solver_finite(center_u)
    || !mechanical_solver_finite(secondary_u)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      primary_index,
      primary_position,
      axis_normal
    );
  let center_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      center_index,
      center_position,
      axis_normal
    );
  let secondary_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      secondary_index,
      secondary_position,
      axis_normal
    );
  if (
    primary_wall_constraint.valid == 0u
    || center_wall_constraint.valid == 0u
    || secondary_wall_constraint.valid == 0u
  ) { return result; }
  let primary_contact_present = abs(primary_contact_sign) > 0.5;
  let secondary_contact_present = abs(secondary_contact_sign) > 0.5;
  let primary_inverse_mass = 1.0 / primary_mass_kg;
  let center_inverse_mass = 1.0 / center_mass_kg;
  let secondary_inverse_mass = 1.0 / secondary_mass_kg;
  let velocity_conditioning = max(
    max(abs(primary_u), abs(center_u)),
    max(abs(secondary_u), 1.0)
  );
  let arithmetic_tolerance_m_per_s = max(
    velocity_tolerance_m_per_s,
    128.0 * 1.1920929e-7 * velocity_conditioning
  );
  let impulse_conditioning = (
    primary_mass_kg + center_mass_kg + secondary_mass_kg
  ) * velocity_conditioning;
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(primary_inverse_mass)
    || !mechanical_solver_finite(center_inverse_mass)
    || !mechanical_solver_finite(secondary_inverse_mass)
    || !mechanical_solver_finite(arithmetic_tolerance_m_per_s)
    || !mechanical_solver_finite(impulse_tolerance)
  ) { return result; }
  var best_found = false;
  var best_objective = 3.0e38;
  for (
    var wall_mask = 0u;
    wall_mask < 8u;
    wall_mask = wall_mask + 1u
  ) {
    let primary_wall_fixed = (wall_mask & 1u) != 0u;
    let center_wall_fixed = (wall_mask & 2u) != 0u;
    let secondary_wall_fixed = (wall_mask & 4u) != 0u;
    if (
      (primary_wall_fixed && primary_wall_constraint.geometry_active == 0u)
      || (center_wall_fixed && center_wall_constraint.geometry_active == 0u)
      || (
        secondary_wall_fixed
        && secondary_wall_constraint.geometry_active == 0u
      )
    ) { continue; }
    let primary_q = select(primary_u, 0.0, primary_wall_fixed);
    let center_q = select(center_u, 0.0, center_wall_fixed);
    let secondary_q = select(secondary_u, 0.0, secondary_wall_fixed);
    let primary_d = select(
      primary_inverse_mass,
      0.0,
      primary_wall_fixed
    );
    let center_d = select(
      center_inverse_mass,
      0.0,
      center_wall_fixed
    );
    let secondary_d = select(
      secondary_inverse_mass,
      0.0,
      secondary_wall_fixed
    );
    let primary_residual =
      primary_contact_sign * (center_q - primary_q);
    let secondary_residual =
      secondary_contact_sign * (center_q - secondary_q);
    let matrix_11 = primary_d + center_d;
    let matrix_22 = center_d + secondary_d;
    let matrix_12 =
      primary_contact_sign * secondary_contact_sign * center_d;
    for (
      var contact_mask = 0u;
      contact_mask < 4u;
      contact_mask = contact_mask + 1u
    ) {
      let primary_contact_active = (contact_mask & 1u) != 0u;
      let secondary_contact_active = (contact_mask & 2u) != 0u;
      if (
        (primary_contact_active && !primary_contact_present)
        || (secondary_contact_active && !secondary_contact_present)
      ) { continue; }
      var candidate_valid = true;
      var primary_lambda = 0.0;
      var secondary_lambda = 0.0;
      if (primary_contact_active && secondary_contact_active) {
        let determinant =
          matrix_11 * matrix_22 - matrix_12 * matrix_12;
        let determinant_conditioning =
          abs(matrix_11 * matrix_22) + abs(matrix_12 * matrix_12);
        let determinant_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7
            * max(determinant_conditioning, 1.0e-12)
        );
        if (
          mechanical_solver_finite(determinant)
          && determinant > determinant_tolerance
        ) {
          primary_lambda = (
            -primary_residual * matrix_22
              + matrix_12 * secondary_residual
          ) / determinant;
          secondary_lambda = (
            -matrix_11 * secondary_residual
              + matrix_12 * primary_residual
          ) / determinant;
        } else if (
          abs(primary_residual) > arithmetic_tolerance_m_per_s
          || abs(secondary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      } else if (primary_contact_active) {
        let diagonal_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(matrix_11), 1.0e-12)
        );
        if (matrix_11 > diagonal_tolerance) {
          primary_lambda = -primary_residual / matrix_11;
        } else if (
          abs(primary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      } else if (secondary_contact_active) {
        let diagonal_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(matrix_22), 1.0e-12)
        );
        if (matrix_22 > diagonal_tolerance) {
          secondary_lambda = -secondary_residual / matrix_22;
        } else if (
          abs(secondary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      }
      if (
        !candidate_valid
        || !mechanical_solver_finite(primary_lambda)
        || !mechanical_solver_finite(secondary_lambda)
        || primary_lambda < -impulse_tolerance
        || secondary_lambda < -impulse_tolerance
      ) { continue; }
      primary_lambda = max(0.0, primary_lambda);
      secondary_lambda = max(0.0, secondary_lambda);
      let primary_pair_impulse =
        -primary_contact_sign * primary_lambda;
      let center_pair_impulse =
        primary_contact_sign * primary_lambda
          + secondary_contact_sign * secondary_lambda;
      let secondary_pair_impulse =
        -secondary_contact_sign * secondary_lambda;
      let candidate_u = mechanical_matching_three_block_axis_primal(
        primary_wall_fixed,
        center_wall_fixed,
        secondary_wall_fixed,
        primary_contact_active,
        secondary_contact_active,
        vec3<f32>(
          primary_mass_kg,
          center_mass_kg,
          secondary_mass_kg
        ),
        vec3<f32>(primary_u, center_u, secondary_u)
      );
      let candidate_primary_u = candidate_u.x;
      let candidate_center_u = candidate_u.y;
      let candidate_secondary_u = candidate_u.z;
      let candidate_primary_residual =
        primary_contact_sign
          * (candidate_center_u - candidate_primary_u);
      let candidate_secondary_residual =
        secondary_contact_sign
          * (candidate_center_u - candidate_secondary_u);
      var contact_feasible = true;
      if (primary_contact_present) {
        contact_feasible = contact_feasible && select(
          candidate_primary_residual >= -velocity_tolerance_m_per_s,
          abs(candidate_primary_residual)
            <= velocity_tolerance_m_per_s,
          primary_contact_active
        );
      }
      if (secondary_contact_present) {
        contact_feasible = contact_feasible && select(
          candidate_secondary_residual >= -velocity_tolerance_m_per_s,
          abs(candidate_secondary_residual)
            <= velocity_tolerance_m_per_s,
          secondary_contact_active
        );
      }
      if (!contact_feasible) { continue; }
      let primary_total_impulse =
        primary_mass_kg * (candidate_primary_u - primary_u);
      let center_total_impulse =
        center_mass_kg * (candidate_center_u - center_u);
      let secondary_total_impulse =
        secondary_mass_kg * (candidate_secondary_u - secondary_u);
      let primary_wall_impulse =
        primary_total_impulse - primary_pair_impulse;
      let center_wall_impulse =
        center_total_impulse - center_pair_impulse;
      let secondary_wall_impulse =
        secondary_total_impulse - secondary_pair_impulse;
      var wall_feasible = true;
      if (primary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_primary_u) <= velocity_tolerance_m_per_s
          && primary_wall_constraint.inward_scalar_sign
            * primary_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(primary_wall_impulse) <= impulse_tolerance;
        if (primary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && primary_wall_constraint.inward_scalar_sign
              * candidate_primary_u >= -velocity_tolerance_m_per_s;
        }
      }
      if (center_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_center_u) <= velocity_tolerance_m_per_s
          && center_wall_constraint.inward_scalar_sign
            * center_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(center_wall_impulse) <= impulse_tolerance;
        if (center_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && center_wall_constraint.inward_scalar_sign
              * candidate_center_u >= -velocity_tolerance_m_per_s;
        }
      }
      if (secondary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_secondary_u) <= velocity_tolerance_m_per_s
          && secondary_wall_constraint.inward_scalar_sign
            * secondary_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(secondary_wall_impulse) <= impulse_tolerance;
        if (secondary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && secondary_wall_constraint.inward_scalar_sign
              * candidate_secondary_u >= -velocity_tolerance_m_per_s;
        }
      }
      let objective =
        primary_mass_kg
          * (candidate_primary_u - primary_u)
          * (candidate_primary_u - primary_u)
        + center_mass_kg
          * (candidate_center_u - center_u)
          * (candidate_center_u - center_u)
        + secondary_mass_kg
          * (candidate_secondary_u - secondary_u)
          * (candidate_secondary_u - secondary_u);
      if (
        !wall_feasible
        || !mechanical_solver_finite(candidate_primary_u)
        || !mechanical_solver_finite(candidate_center_u)
        || !mechanical_solver_finite(candidate_secondary_u)
        || !mechanical_solver_finite(primary_wall_impulse)
        || !mechanical_solver_finite(center_wall_impulse)
        || !mechanical_solver_finite(secondary_wall_impulse)
        || !mechanical_solver_finite(objective)
      ) { continue; }
      if (!best_found || objective < best_objective) {
        best_found = true;
        best_objective = objective;
        result.primary_u = candidate_primary_u;
        result.center_u = candidate_center_u;
        result.secondary_u = candidate_secondary_u;
        result.primary_lambda = primary_lambda;
        result.secondary_lambda = secondary_lambda;
        result.wall_mask = wall_mask;
      }
    }
  }
  result.valid = select(0u, 1u, best_found);
  return result;
}

fn mechanical_matching_wall_energy_allocation(
  wall_kinetic_delta_j: f32,
  masses_kg: vec3<f32>,
  wall_mask: u32,
  kinetic_tolerance_j: f32
) -> vec4<f32> {
  var allocation = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite3(masses_kg)
    || !mechanical_solver_finite(kinetic_tolerance_j)
  ) {
    allocation.w = 0.0;
    return allocation;
  }
  if (wall_mask == 0u) {
    if (abs(wall_kinetic_delta_j) > kinetic_tolerance_j) {
      allocation.w = 0.0;
    }
    return allocation;
  }
  let fixed_mass_kg =
    select(0.0, masses_kg.x, (wall_mask & 1u) != 0u)
      + select(0.0, masses_kg.y, (wall_mask & 2u) != 0u)
      + select(0.0, masses_kg.z, (wall_mask & 4u) != 0u);
  if (
    !(fixed_mass_kg > 0.0)
    || !mechanical_solver_finite(fixed_mass_kg)
  ) {
    allocation.w = 0.0;
    return allocation;
  }
  allocation.x = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.x / fixed_mass_kg,
    (wall_mask & 1u) != 0u
  );
  allocation.y = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.y / fixed_mass_kg,
    (wall_mask & 2u) != 0u
  );
  allocation.z = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.z / fixed_mass_kg,
    (wall_mask & 4u) != 0u
  );
  return allocation;
}

// Exact fixed-cost projection for every axis-aligned three-contact/wall
// configuration. Each lane enumerates 8 wall masks x 4 contact masks, so the
// total work is 3 x 8 x 4 candidates independent of particle count or degree.
fn mechanical_matching_three_block_box_wall_active_set(
  seed: MechanicalMatchingThreeBlockResult,
  primary_normal: vec3<f32>,
  secondary_normal: vec3<f32>,
  primary_pos_mass: vec4<f32>,
  center_pos_mass: vec4<f32>,
  secondary_pos_mass: vec4<f32>,
  primary_velocity: vec3<f32>,
  center_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  contact_primary_velocity: vec3<f32>,
  contact_center_velocity: vec3<f32>,
  contact_secondary_velocity: vec3<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  if (
    !mechanical_matching_axis_contact_normal_valid(primary_normal)
    || !mechanical_matching_axis_contact_normal_valid(secondary_normal)
    || !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite3(contact_primary_velocity)
    || !mechanical_solver_finite3(contact_center_velocity)
    || !mechanical_solver_finite3(contact_secondary_velocity)
  ) { return result; }
  let primary_mass_kg = primary_pos_mass.w;
  let center_mass_kg = center_pos_mass.w;
  let secondary_mass_kg = secondary_pos_mass.w;
  let x_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(1.0, 0.0, 0.0),
    primary_normal.x,
    secondary_normal.x,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.x,
    center_velocity.x,
    secondary_velocity.x,
    velocity_tolerance_m_per_s
  );
  let y_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(0.0, 1.0, 0.0),
    primary_normal.y,
    secondary_normal.y,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.y,
    center_velocity.y,
    secondary_velocity.y,
    velocity_tolerance_m_per_s
  );
  let z_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(0.0, 0.0, 1.0),
    primary_normal.z,
    secondary_normal.z,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.z,
    center_velocity.z,
    secondary_velocity.z,
    velocity_tolerance_m_per_s
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  let resolved_primary_velocity = vec3<f32>(
    x_axis.primary_u,
    y_axis.primary_u,
    z_axis.primary_u
  );
  let resolved_center_velocity = vec3<f32>(
    x_axis.center_u,
    y_axis.center_u,
    z_axis.center_u
  );
  let resolved_secondary_velocity = vec3<f32>(
    x_axis.secondary_u,
    y_axis.secondary_u,
    z_axis.secondary_u
  );
  let primary_impulse = vec3<f32>(
    -primary_normal.x * x_axis.primary_lambda,
    -primary_normal.y * y_axis.primary_lambda,
    -primary_normal.z * z_axis.primary_lambda
  );
  let center_primary_impulse = -primary_impulse;
  let secondary_impulse = vec3<f32>(
    -secondary_normal.x * x_axis.secondary_lambda,
    -secondary_normal.y * y_axis.secondary_lambda,
    -secondary_normal.z * z_axis.secondary_lambda
  );
  let center_secondary_impulse = -secondary_impulse;
  let final_primary_residual = dot(
    resolved_center_velocity - resolved_primary_velocity,
    primary_normal
  );
  let final_secondary_residual = dot(
    resolved_center_velocity - resolved_secondary_velocity,
    secondary_normal
  );
  let pair_momentum_residual =
    primary_impulse
      + center_primary_impulse
      + center_secondary_impulse
      + secondary_impulse;
  let pair_momentum_conditioning =
    length(primary_impulse)
      + length(center_primary_impulse)
      + length(center_secondary_impulse)
      + length(secondary_impulse);
  let pair_momentum_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7
      * max(pair_momentum_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite3(resolved_primary_velocity)
    || !mechanical_solver_finite3(resolved_center_velocity)
    || !mechanical_solver_finite3(resolved_secondary_velocity)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(center_primary_impulse)
    || !mechanical_solver_finite3(center_secondary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(pair_momentum_residual)
    || length(pair_momentum_residual) > pair_momentum_tolerance
    || !mechanical_solver_finite(final_primary_residual)
    || !mechanical_solver_finite(final_secondary_residual)
    || final_primary_residual < -velocity_tolerance_m_per_s
    || final_secondary_residual < -velocity_tolerance_m_per_s
  ) { return result; }
  let resolved_primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    resolved_primary_velocity,
    primary_mass_kg
  );
  let resolved_center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    resolved_center_velocity,
    center_mass_kg
  );
  let resolved_secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    resolved_secondary_velocity,
    secondary_mass_kg
  );
  if (
    resolved_primary_wall.valid == 0u
    || resolved_center_wall.valid == 0u
    || resolved_secondary_wall.valid == 0u
    || resolved_primary_wall.clipped != 0u
    || resolved_center_wall.clipped != 0u
    || resolved_secondary_wall.clipped != 0u
  ) { return result; }
  let primary_pair_kinetic_delta_j = 0.5 * primary_mass_kg * (
    dot(contact_primary_velocity, contact_primary_velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_pair_kinetic_delta_j = 0.5 * center_mass_kg * (
    dot(contact_center_velocity, contact_center_velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_pair_kinetic_delta_j = 0.5 * secondary_mass_kg * (
    dot(contact_secondary_velocity, contact_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let pair_kinetic_delta_j =
    primary_pair_kinetic_delta_j
      + center_pair_kinetic_delta_j
      + secondary_pair_kinetic_delta_j;
  let wall_kinetic_delta_x_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.x * resolved_primary_velocity.x
        - contact_primary_velocity.x * contact_primary_velocity.x
    )
      + center_mass_kg * (
        resolved_center_velocity.x * resolved_center_velocity.x
          - contact_center_velocity.x * contact_center_velocity.x
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.x * resolved_secondary_velocity.x
          - contact_secondary_velocity.x * contact_secondary_velocity.x
      )
  );
  let wall_kinetic_delta_y_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.y * resolved_primary_velocity.y
        - contact_primary_velocity.y * contact_primary_velocity.y
    )
      + center_mass_kg * (
        resolved_center_velocity.y * resolved_center_velocity.y
          - contact_center_velocity.y * contact_center_velocity.y
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.y * resolved_secondary_velocity.y
          - contact_secondary_velocity.y * contact_secondary_velocity.y
      )
  );
  let wall_kinetic_delta_z_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.z * resolved_primary_velocity.z
        - contact_primary_velocity.z * contact_primary_velocity.z
    )
      + center_mass_kg * (
        resolved_center_velocity.z * resolved_center_velocity.z
          - contact_center_velocity.z * contact_center_velocity.z
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.z * resolved_secondary_velocity.z
          - contact_secondary_velocity.z * contact_secondary_velocity.z
      )
  );
  let wall_kinetic_delta_j =
    wall_kinetic_delta_x_j
      + wall_kinetic_delta_y_j
      + wall_kinetic_delta_z_j;
  let total_kinetic_delta_j = 0.5 * (
    primary_mass_kg * (
      dot(resolved_primary_velocity, resolved_primary_velocity)
        - dot(primary_velocity, primary_velocity)
    )
      + center_mass_kg * (
        dot(resolved_center_velocity, resolved_center_velocity)
          - dot(center_velocity, center_velocity)
      )
      + secondary_mass_kg * (
        dot(resolved_secondary_velocity, resolved_secondary_velocity)
          - dot(secondary_velocity, secondary_velocity)
      )
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_mass_kg * (
      dot(primary_velocity, primary_velocity)
        + dot(contact_primary_velocity, contact_primary_velocity)
        + dot(resolved_primary_velocity, resolved_primary_velocity)
    )
      + center_mass_kg * (
        dot(center_velocity, center_velocity)
          + dot(contact_center_velocity, contact_center_velocity)
          + dot(resolved_center_velocity, resolved_center_velocity)
      )
      + secondary_mass_kg * (
        dot(secondary_velocity, secondary_velocity)
          + dot(contact_secondary_velocity, contact_secondary_velocity)
          + dot(resolved_secondary_velocity, resolved_secondary_velocity)
      )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  let masses_kg = vec3<f32>(
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg
  );
  let x_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_x_j,
    masses_kg,
    x_axis.wall_mask,
    kinetic_tolerance_j
  );
  let y_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_y_j,
    masses_kg,
    y_axis.wall_mask,
    kinetic_tolerance_j
  );
  let z_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_z_j,
    masses_kg,
    z_axis.wall_mask,
    kinetic_tolerance_j
  );
  let wall_allocations =
    x_wall_allocation.xyz
      + y_wall_allocation.xyz
      + z_wall_allocation.xyz;
  if (
    x_wall_allocation.w == 0.0
    || y_wall_allocation.w == 0.0
    || z_wall_allocation.w == 0.0
    || !mechanical_solver_finite(primary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(center_pair_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(pair_kinetic_delta_j)
    || !mechanical_solver_finite(wall_kinetic_delta_x_j)
    || !mechanical_solver_finite(wall_kinetic_delta_y_j)
    || !mechanical_solver_finite(wall_kinetic_delta_z_j)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(total_kinetic_delta_j)
    || !mechanical_solver_finite3(wall_allocations)
    || pair_kinetic_delta_j > kinetic_tolerance_j
    || wall_kinetic_delta_x_j > kinetic_tolerance_j
    || wall_kinetic_delta_y_j > kinetic_tolerance_j
    || wall_kinetic_delta_z_j > kinetic_tolerance_j
    || wall_kinetic_delta_j > kinetic_tolerance_j
    || wall_allocations.x > kinetic_tolerance_j
    || wall_allocations.y > kinetic_tolerance_j
    || wall_allocations.z > kinetic_tolerance_j
    || abs(
      total_kinetic_delta_j
        - pair_kinetic_delta_j
        - wall_kinetic_delta_j
    ) > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = resolved_primary_velocity;
  result.center_velocity = resolved_center_velocity;
  result.secondary_velocity = resolved_secondary_velocity;
  result.primary_kinetic_delta_j = primary_pair_kinetic_delta_j;
  result.center_kinetic_delta_j = center_pair_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_pair_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = wall_allocations.x;
  result.center_wall_kinetic_delta_j = wall_allocations.y;
  result.secondary_wall_kinetic_delta_j = wall_allocations.z;
  result.pair_heat_j = max(0.0, -pair_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = center_primary_impulse;
  result.center_secondary_impulse = center_secondary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.applied = 1u;
  return result;
}

fn mechanical_matching_inbound_candidate_better(
  candidate_priority: f32,
  candidate_face_alignment: f32,
  candidate_rank: u32,
  candidate_low: u32,
  candidate_high: u32,
  incumbent_priority: f32,
  incumbent_face_alignment: f32,
  incumbent_rank: u32,
  incumbent_low: u32,
  incumbent_high: u32
) -> bool {
  return candidate_priority > incumbent_priority
    || (
      candidate_priority == incumbent_priority
      && (
        candidate_face_alignment > incumbent_face_alignment
        || (
          candidate_face_alignment == incumbent_face_alignment
          && (
            candidate_rank < incumbent_rank
            || (
              candidate_rank == incumbent_rank
              && (
                candidate_low < incumbent_low
                || (
                  candidate_low == incumbent_low
                  && candidate_high < incumbent_high
                )
              )
            )
          )
        )
      )
  );
}

fn mechanical_matching_zero_four_path_candidate() ->
  MechanicalMatchingFourPathCandidate {
  return MechanicalMatchingFourPathCandidate(
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0.0,
    0xffffffffu,
    0u,
    1u
  );
}

// Lift the particle matching into a matching of two already-disjoint mutual
// pairs. An inactive contact may bridge those pairs after the prior sweep.
// Ranking by the strict-light mass ratio makes both mutual pairs choose the
// same ill-conditioned bridge; the reciprocal-choice check in the caller
// makes the merged four-body write race-free without atomics.
fn mechanical_matching_four_path_candidate(
  mutual_low: u32,
  mutual_high: u32,
  published_total: u32
) -> MechanicalMatchingFourPathCandidate {
  var result = mechanical_matching_zero_four_path_candidate();
  if (
    mutual_low >= mutual_high
    || mutual_high >= mechanical_params.particle_count
    || published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    result.valid = 0u;
    return result;
  }
  let low_selection = energy_ledger[mechanical_energy_base(mutual_low)];
  let high_selection = energy_ledger[mechanical_energy_base(mutual_high)];
  if (
    bitcast<u32>(low_selection.x) != mutual_high
    || bitcast<u32>(high_selection.x) != mutual_low
  ) { return result; }
  for (var endpoint_slot = 0u; endpoint_slot < 2u;
    endpoint_slot = endpoint_slot + 1u) {
    let current_index = select(
      mutual_low,
      mutual_high,
      endpoint_slot != 0u
    );
    let current_partner = select(
      mutual_high,
      mutual_low,
      endpoint_slot != 0u
    );
    let current_selection = select(
      low_selection,
      high_selection,
      endpoint_slot != 0u
    );
    let current_partner_selection = select(
      high_selection,
      low_selection,
      endpoint_slot != 0u
    );
    let begin = source_offsets[current_index];
    let end = source_offsets[current_index + 1u];
    if (begin > end || end > published_total) {
      result.valid = 0u;
      return result;
    }
    for (var bridge_cursor = begin; bridge_cursor < end;
      bridge_cursor = bridge_cursor + 1u) {
      let encoded_bridge_peer = csr_peers[bridge_cursor];
      let bridge_peer = mechanical_solver_peer_index(encoded_bridge_peer);
      if (
        bridge_peer == current_partner
        || bridge_peer >= mechanical_params.particle_count
        || !mechanical_solver_edge_inactive(encoded_bridge_peer)
      ) { continue; }
      let peer_selection =
        energy_ledger[mechanical_energy_base(bridge_peer)];
      let peer_partner = bitcast<u32>(peer_selection.x);
      if (
        peer_partner >= mechanical_params.particle_count
        || peer_partner == current_index
        || peer_partner == current_partner
        || peer_partner == bridge_peer
      ) { continue; }
      let peer_partner_selection =
        energy_ledger[mechanical_energy_base(peer_partner)];
      if (bitcast<u32>(peer_partner_selection.x) != bridge_peer) {
        continue;
      }
      let peer_begin = source_offsets[bridge_peer];
      let peer_end = source_offsets[bridge_peer + 1u];
      if (peer_begin > peer_end || peer_end > published_total) {
        result.valid = 0u;
        return result;
      }
      var bridge_reverse_cursor = 0xffffffffu;
      for (var cursor = peer_begin; cursor < peer_end;
        cursor = cursor + 1u) {
        if (
          mechanical_solver_peer_index(csr_peers[cursor]) == current_index
        ) {
          bridge_reverse_cursor = cursor;
          break;
        }
      }
      if (
        bridge_reverse_cursor == 0xffffffffu
        || !mechanical_solver_edge_inactive(
          csr_peers[bridge_reverse_cursor]
        )
      ) { continue; }
      let current_mass = input_state[current_index * 2u].w;
      let current_partner_mass = input_state[current_partner * 2u].w;
      let peer_mass = input_state[bridge_peer * 2u].w;
      let peer_partner_mass = input_state[peer_partner * 2u].w;
      if (
        !(current_mass > 0.0)
        || !(current_partner_mass > 0.0)
        || !(peer_mass > 0.0)
        || !(peer_partner_mass > 0.0)
        || !mechanical_solver_finite(current_mass)
        || !mechanical_solver_finite(current_partner_mass)
        || !mechanical_solver_finite(peer_mass)
        || !mechanical_solver_finite(peer_partner_mass)
      ) {
        result.valid = 0u;
        return result;
      }
      let current_is_light = current_mass < peer_mass
        && current_mass < current_partner_mass;
      let peer_is_light = peer_mass < current_mass
        && peer_mass < peer_partner_mass;
      if (current_is_light == peer_is_light) { continue; }
      let bridge_pair = mechanical_matching_constraint_pair(
        min(current_index, bridge_peer),
        max(current_index, bridge_peer),
        bridge_cursor
      );
      if (bridge_pair.valid == 0u) {
        result.valid = 0u;
        return result;
      }
      if (
        bridge_pair.active_pair == 0u
        || bridge_pair.unilateral == 0u
      ) { continue; }
      var candidate = mechanical_matching_zero_four_path_candidate();
      if (current_is_light) {
        candidate.body_0_index = current_partner;
        candidate.body_1_index = current_index;
        candidate.body_2_index = bridge_peer;
        candidate.body_3_index = peer_partner;
        candidate.edge_0_forward_cursor = bitcast<u32>(current_selection.z);
        candidate.edge_0_reverse_cursor =
          bitcast<u32>(current_partner_selection.z);
        candidate.edge_1_forward_cursor = bridge_cursor;
        candidate.edge_1_reverse_cursor = bridge_reverse_cursor;
        candidate.edge_2_forward_cursor = bitcast<u32>(peer_selection.z);
        candidate.edge_2_reverse_cursor =
          bitcast<u32>(peer_partner_selection.z);
      } else {
        candidate.body_0_index = peer_partner;
        candidate.body_1_index = bridge_peer;
        candidate.body_2_index = current_index;
        candidate.body_3_index = current_partner;
        candidate.edge_0_forward_cursor = bitcast<u32>(peer_selection.z);
        candidate.edge_0_reverse_cursor =
          bitcast<u32>(peer_partner_selection.z);
        candidate.edge_1_forward_cursor = bridge_reverse_cursor;
        candidate.edge_1_reverse_cursor = bridge_cursor;
        candidate.edge_2_forward_cursor = bitcast<u32>(current_selection.z);
        candidate.edge_2_reverse_cursor =
          bitcast<u32>(current_partner_selection.z);
      }
      let body_0_mass = input_state[candidate.body_0_index * 2u].w;
      let body_1_mass = input_state[candidate.body_1_index * 2u].w;
      let body_2_mass = input_state[candidate.body_2_index * 2u].w;
      candidate.light_mass_ratio = min(body_0_mass, body_2_mass)
        / body_1_mass;
      candidate.bridge_rank = mechanical_matching_edge_rank(
        min(candidate.body_1_index, candidate.body_2_index),
        max(candidate.body_1_index, candidate.body_2_index)
      );
      candidate.found = 1u;
      let better = result.found == 0u
        || candidate.light_mass_ratio > result.light_mass_ratio
        || (
          candidate.light_mass_ratio == result.light_mass_ratio
          && (
            candidate.bridge_rank < result.bridge_rank
            || (
              candidate.bridge_rank == result.bridge_rank
              && (
                candidate.body_0_index < result.body_0_index
                || (
                  candidate.body_0_index == result.body_0_index
                  && candidate.body_1_index < result.body_1_index
                )
              )
            )
          )
        );
      if (better) { result = candidate; }
    }
  }
  return result;
}

// Exact mass-metric projection for the path 0--1--2--3 on one Cartesian
// lane. The eight active masks reduce to explicit connected-component pools.
fn mechanical_matching_four_path_axis_active_set(
  edge_0_sign: f32,
  edge_1_sign: f32,
  edge_2_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockAxisResult {
  var result = MechanicalMatchingFourBlockAxisResult(
    input_u,
    0.0,
    0u,
    0u
  );
  let edge_0_present = abs(edge_0_sign) > 0.5;
  let edge_1_present = abs(edge_1_sign) > 0.5;
  let edge_2_present = abs(edge_2_sign) > 0.5;
  if (
    !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
  ) { return result; }
  for (var contact_mask = 0u; contact_mask < 8u;
    contact_mask = contact_mask + 1u) {
    let edge_0_active = (contact_mask & 1u) != 0u;
    let edge_1_active = (contact_mask & 2u) != 0u;
    let edge_2_active = (contact_mask & 4u) != 0u;
    if (
      (edge_0_active && !edge_0_present)
      || (edge_1_active && !edge_1_present)
      || (edge_2_active && !edge_2_present)
    ) { continue; }
    var candidate_u = input_u;
    if (contact_mask == 1u || contact_mask == 5u) {
      let shared_01 = (
        masses_kg.x * input_u.x + masses_kg.y * input_u.y
      ) / (masses_kg.x + masses_kg.y);
      candidate_u.x = shared_01;
      candidate_u.y = shared_01;
    }
    if (contact_mask == 2u) {
      let shared_12 = (
        masses_kg.y * input_u.y + masses_kg.z * input_u.z
      ) / (masses_kg.y + masses_kg.z);
      candidate_u.y = shared_12;
      candidate_u.z = shared_12;
    }
    if (contact_mask == 4u || contact_mask == 5u) {
      let shared_23 = (
        masses_kg.z * input_u.z + masses_kg.w * input_u.w
      ) / (masses_kg.z + masses_kg.w);
      candidate_u.z = shared_23;
      candidate_u.w = shared_23;
    }
    if (contact_mask == 3u) {
      let shared_012 = (
        masses_kg.x * input_u.x
          + masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
      ) / (masses_kg.x + masses_kg.y + masses_kg.z);
      candidate_u.x = shared_012;
      candidate_u.y = shared_012;
      candidate_u.z = shared_012;
    }
    if (contact_mask == 6u) {
      let shared_123 = (
        masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
          + masses_kg.w * input_u.w
      ) / (masses_kg.y + masses_kg.z + masses_kg.w);
      candidate_u.y = shared_123;
      candidate_u.z = shared_123;
      candidate_u.w = shared_123;
    }
    if (contact_mask == 7u) {
      let shared_0123 = dot(masses_kg, input_u)
        / (masses_kg.x + masses_kg.y + masses_kg.z + masses_kg.w);
      candidate_u = vec4<f32>(shared_0123);
    }
    let residual = vec3<f32>(
      edge_0_sign * (candidate_u.y - candidate_u.x),
      edge_1_sign * (candidate_u.y - candidate_u.z),
      edge_2_sign * (candidate_u.z - candidate_u.w)
    );
    if (
      (edge_0_present
        && residual.x < -velocity_tolerance_m_per_s)
      || (edge_1_present
        && residual.y < -velocity_tolerance_m_per_s)
      || (edge_2_present
        && residual.z < -velocity_tolerance_m_per_s)
    ) { continue; }
    let delta_u = candidate_u - input_u;
    let objective = dot(masses_kg, delta_u * delta_u);
    if (
      !mechanical_solver_finite(candidate_u.x)
      || !mechanical_solver_finite(candidate_u.y)
      || !mechanical_solver_finite(candidate_u.z)
      || !mechanical_solver_finite(candidate_u.w)
      || !mechanical_solver_finite3(residual)
      || !mechanical_solver_finite(objective)
    ) { continue; }
    if (result.valid == 0u || objective < result.objective) {
      result.velocity = candidate_u;
      result.objective = objective;
      result.contact_mask = contact_mask;
      result.valid = 1u;
    }
  }
  return result;
}

// A four-body star has one center and three leaves. On one Cartesian lane,
// every active contact equality therefore joins another leaf to the center's
// single pooled component. Enumerating the eight contact masks gives the
// exact mass-metric projection without an iterative per-candidate solve.
fn mechanical_matching_four_block_axis_active_set(
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  tertiary_contact_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockAxisResult {
  var result = MechanicalMatchingFourBlockAxisResult(
    input_u,
    0.0,
    0u,
    0u
  );
  let primary_sign_valid = abs(primary_contact_sign) <= 1.0e-6
    || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid = abs(secondary_contact_sign) <= 1.0e-6
    || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  let tertiary_sign_valid = abs(tertiary_contact_sign) <= 1.0e-6
    || abs(abs(tertiary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !tertiary_sign_valid
    || !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_present = abs(primary_contact_sign) > 0.5;
  let secondary_present = abs(secondary_contact_sign) > 0.5;
  let tertiary_present = abs(tertiary_contact_sign) > 0.5;
  for (var contact_mask = 0u; contact_mask < 8u;
    contact_mask = contact_mask + 1u) {
    let primary_active = (contact_mask & 1u) != 0u;
    let secondary_active = (contact_mask & 2u) != 0u;
    let tertiary_active = (contact_mask & 4u) != 0u;
    if (
      (primary_active && !primary_present)
      || (secondary_active && !secondary_present)
      || (tertiary_active && !tertiary_present)
    ) { continue; }
    var pooled_mass_kg = masses_kg.y;
    var pooled_momentum = masses_kg.y * input_u.y;
    if (primary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.x;
      pooled_momentum = pooled_momentum + masses_kg.x * input_u.x;
    }
    if (secondary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.z;
      pooled_momentum = pooled_momentum + masses_kg.z * input_u.z;
    }
    if (tertiary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.w;
      pooled_momentum = pooled_momentum + masses_kg.w * input_u.w;
    }
    if (
      !(pooled_mass_kg > 0.0)
      || !mechanical_solver_finite(pooled_mass_kg)
      || !mechanical_solver_finite(pooled_momentum)
    ) { continue; }
    let shared_u = pooled_momentum / pooled_mass_kg;
    var candidate_u = input_u;
    candidate_u.y = shared_u;
    if (primary_active) { candidate_u.x = shared_u; }
    if (secondary_active) { candidate_u.z = shared_u; }
    if (tertiary_active) { candidate_u.w = shared_u; }
    let primary_residual =
      primary_contact_sign * (candidate_u.y - candidate_u.x);
    let secondary_residual =
      secondary_contact_sign * (candidate_u.y - candidate_u.z);
    let tertiary_residual =
      tertiary_contact_sign * (candidate_u.y - candidate_u.w);
    if (
      (primary_present
        && primary_residual < -velocity_tolerance_m_per_s)
      || (secondary_present
        && secondary_residual < -velocity_tolerance_m_per_s)
      || (tertiary_present
        && tertiary_residual < -velocity_tolerance_m_per_s)
    ) { continue; }
    let delta_u = candidate_u - input_u;
    let objective = dot(masses_kg, delta_u * delta_u);
    if (
      !mechanical_solver_finite(shared_u)
      || !mechanical_solver_finite(candidate_u.x)
      || !mechanical_solver_finite(candidate_u.y)
      || !mechanical_solver_finite(candidate_u.z)
      || !mechanical_solver_finite(candidate_u.w)
      || !mechanical_solver_finite(primary_residual)
      || !mechanical_solver_finite(secondary_residual)
      || !mechanical_solver_finite(tertiary_residual)
      || !mechanical_solver_finite(objective)
    ) { continue; }
    if (result.valid == 0u || objective < result.objective) {
      result.velocity = candidate_u;
      result.objective = objective;
      result.contact_mask = contact_mask;
      result.valid = 1u;
    }
  }
  return result;
}

// Exact fixed-cost projection for one lane of a four-body star coupled to
// axis-aligned box walls. Every candidate is a closed KKT active set:
// 16 wall masks x 8 contact masks, independent of particle count or degree.
fn mechanical_matching_four_block_box_axis_active_set(
  primary_index: u32,
  center_index: u32,
  secondary_index: u32,
  tertiary_index: u32,
  primary_position: vec3<f32>,
  center_position: vec3<f32>,
  secondary_position: vec3<f32>,
  tertiary_position: vec3<f32>,
  axis_normal: vec3<f32>,
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  tertiary_contact_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockBoxAxisResult {
  var result = MechanicalMatchingFourBlockBoxAxisResult(
    input_u,
    vec3<f32>(0.0),
    0.0,
    0u,
    0u,
    0u
  );
  let primary_sign_valid = abs(primary_contact_sign) <= 1.0e-6
    || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid = abs(secondary_contact_sign) <= 1.0e-6
    || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  let tertiary_sign_valid = abs(tertiary_contact_sign) <= 1.0e-6
    || abs(abs(tertiary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !tertiary_sign_valid
    || !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_wall_constraint = mechanical_matching_axis_wall_constraint(
    primary_index,
    primary_position,
    axis_normal
  );
  let center_wall_constraint = mechanical_matching_axis_wall_constraint(
    center_index,
    center_position,
    axis_normal
  );
  let secondary_wall_constraint = mechanical_matching_axis_wall_constraint(
    secondary_index,
    secondary_position,
    axis_normal
  );
  let tertiary_wall_constraint = mechanical_matching_axis_wall_constraint(
    tertiary_index,
    tertiary_position,
    axis_normal
  );
  if (
    primary_wall_constraint.valid == 0u
    || center_wall_constraint.valid == 0u
    || secondary_wall_constraint.valid == 0u
    || tertiary_wall_constraint.valid == 0u
  ) { return result; }
  let primary_present = abs(primary_contact_sign) > 0.5;
  let secondary_present = abs(secondary_contact_sign) > 0.5;
  let tertiary_present = abs(tertiary_contact_sign) > 0.5;
  let inverse_mass = vec4<f32>(
    1.0 / masses_kg.x,
    1.0 / masses_kg.y,
    1.0 / masses_kg.z,
    1.0 / masses_kg.w
  );
  let velocity_conditioning = max(
    max(abs(input_u.x), abs(input_u.y)),
    max(max(abs(input_u.z), abs(input_u.w)), 1.0)
  );
  let arithmetic_tolerance_m_per_s = max(
    velocity_tolerance_m_per_s,
    128.0 * 1.1920929e-7 * velocity_conditioning
  );
  let impulse_conditioning = (
    masses_kg.x + masses_kg.y + masses_kg.z + masses_kg.w
  ) * velocity_conditioning;
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(inverse_mass.x)
    || !mechanical_solver_finite(inverse_mass.y)
    || !mechanical_solver_finite(inverse_mass.z)
    || !mechanical_solver_finite(inverse_mass.w)
    || !mechanical_solver_finite(arithmetic_tolerance_m_per_s)
    || !mechanical_solver_finite(impulse_tolerance)
  ) { return result; }
  for (var wall_mask = 0u; wall_mask < 16u;
    wall_mask = wall_mask + 1u) {
    let primary_wall_fixed = (wall_mask & 1u) != 0u;
    let center_wall_fixed = (wall_mask & 2u) != 0u;
    let secondary_wall_fixed = (wall_mask & 4u) != 0u;
    let tertiary_wall_fixed = (wall_mask & 8u) != 0u;
    if (
      (primary_wall_fixed
        && primary_wall_constraint.geometry_active == 0u)
      || (center_wall_fixed
        && center_wall_constraint.geometry_active == 0u)
      || (secondary_wall_fixed
        && secondary_wall_constraint.geometry_active == 0u)
      || (tertiary_wall_fixed
        && tertiary_wall_constraint.geometry_active == 0u)
    ) { continue; }
    let q = vec4<f32>(
      select(input_u.x, 0.0, primary_wall_fixed),
      select(input_u.y, 0.0, center_wall_fixed),
      select(input_u.z, 0.0, secondary_wall_fixed),
      select(input_u.w, 0.0, tertiary_wall_fixed)
    );
    let d = vec4<f32>(
      select(inverse_mass.x, 0.0, primary_wall_fixed),
      select(inverse_mass.y, 0.0, center_wall_fixed),
      select(inverse_mass.z, 0.0, secondary_wall_fixed),
      select(inverse_mass.w, 0.0, tertiary_wall_fixed)
    );
    let residual = vec3<f32>(
      primary_contact_sign * (q.y - q.x),
      secondary_contact_sign * (q.y - q.z),
      tertiary_contact_sign * (q.y - q.w)
    );
    let diagonal = vec3<f32>(d.x + d.y, d.z + d.y, d.w + d.y);
    let cross_12 = primary_contact_sign
      * secondary_contact_sign * d.y;
    let cross_13 = primary_contact_sign
      * tertiary_contact_sign * d.y;
    let cross_23 = secondary_contact_sign
      * tertiary_contact_sign * d.y;
    for (var contact_mask = 0u; contact_mask < 8u;
      contact_mask = contact_mask + 1u) {
      let primary_active = (contact_mask & 1u) != 0u;
      let secondary_active = (contact_mask & 2u) != 0u;
      let tertiary_active = (contact_mask & 4u) != 0u;
      if (
        (primary_active && !primary_present)
        || (secondary_active && !secondary_present)
        || (tertiary_active && !tertiary_present)
      ) { continue; }
      var candidate_valid = true;
      var contact_lambda = vec3<f32>(0.0);
      if (contact_mask == 1u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.x), 1.0e-12)
        );
        if (diagonal.x > tolerance) {
          contact_lambda.x = -residual.x / diagonal.x;
        } else if (abs(residual.x) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 2u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.y), 1.0e-12)
        );
        if (diagonal.y > tolerance) {
          contact_lambda.y = -residual.y / diagonal.y;
        } else if (abs(residual.y) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 4u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.z), 1.0e-12)
        );
        if (diagonal.z > tolerance) {
          contact_lambda.z = -residual.z / diagonal.z;
        } else if (abs(residual.z) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 3u) {
        let determinant = diagonal.x * diagonal.y
          - cross_12 * cross_12;
        let conditioning = abs(diagonal.x * diagonal.y)
          + abs(cross_12 * cross_12);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.x = (
            -residual.x * diagonal.y + cross_12 * residual.y
          ) / determinant;
          contact_lambda.y = (
            -diagonal.x * residual.y + cross_12 * residual.x
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.y) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 5u) {
        let determinant = diagonal.x * diagonal.z
          - cross_13 * cross_13;
        let conditioning = abs(diagonal.x * diagonal.z)
          + abs(cross_13 * cross_13);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.x = (
            -residual.x * diagonal.z + cross_13 * residual.z
          ) / determinant;
          contact_lambda.z = (
            -diagonal.x * residual.z + cross_13 * residual.x
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 6u) {
        let determinant = diagonal.y * diagonal.z
          - cross_23 * cross_23;
        let conditioning = abs(diagonal.y * diagonal.z)
          + abs(cross_23 * cross_23);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.y = (
            -residual.y * diagonal.z + cross_23 * residual.z
          ) / determinant;
          contact_lambda.z = (
            -diagonal.y * residual.z + cross_23 * residual.y
          ) / determinant;
        } else if (
          abs(residual.y) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 7u) {
        let cofactor_11 = diagonal.y * diagonal.z
          - cross_23 * cross_23;
        let cofactor_12 = cross_13 * cross_23
          - cross_12 * diagonal.z;
        let cofactor_13 = cross_12 * cross_23
          - diagonal.y * cross_13;
        let cofactor_22 = diagonal.x * diagonal.z
          - cross_13 * cross_13;
        let cofactor_23 = cross_12 * cross_13
          - diagonal.x * cross_23;
        let cofactor_33 = diagonal.x * diagonal.y
          - cross_12 * cross_12;
        let determinant = diagonal.x * cofactor_11
          + cross_12 * cofactor_12
          + cross_13 * cofactor_13;
        let conditioning = abs(diagonal.x * diagonal.y * diagonal.z)
          + 2.0 * abs(cross_12 * cross_13 * cross_23)
          + abs(diagonal.x * cross_23 * cross_23)
          + abs(diagonal.y * cross_13 * cross_13)
          + abs(diagonal.z * cross_12 * cross_12);
        let tolerance = max(
          1.0e-12,
          128.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          let rhs = -residual;
          contact_lambda = vec3<f32>(
            dot(vec3<f32>(cofactor_11, cofactor_12, cofactor_13), rhs),
            dot(vec3<f32>(cofactor_12, cofactor_22, cofactor_23), rhs),
            dot(vec3<f32>(cofactor_13, cofactor_23, cofactor_33), rhs)
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.y) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      }
      if (
        !candidate_valid
        || !mechanical_solver_finite3(contact_lambda)
        || contact_lambda.x < -impulse_tolerance
        || contact_lambda.y < -impulse_tolerance
        || contact_lambda.z < -impulse_tolerance
      ) { continue; }
      contact_lambda = max(contact_lambda, vec3<f32>(0.0));
      var pooled_mass_kg = masses_kg.y;
      var pooled_momentum = masses_kg.y * input_u.y;
      if (primary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.x;
        pooled_momentum = pooled_momentum + masses_kg.x * input_u.x;
      }
      if (secondary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.z;
        pooled_momentum = pooled_momentum + masses_kg.z * input_u.z;
      }
      if (tertiary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.w;
        pooled_momentum = pooled_momentum + masses_kg.w * input_u.w;
      }
      let component_wall_fixed = center_wall_fixed
        || (primary_active && primary_wall_fixed)
        || (secondary_active && secondary_wall_fixed)
        || (tertiary_active && tertiary_wall_fixed);
      let shared_u = select(
        pooled_momentum / pooled_mass_kg,
        0.0,
        component_wall_fixed
      );
      var candidate_u = vec4<f32>(
        select(input_u.x, 0.0, primary_wall_fixed),
        select(input_u.y, 0.0, center_wall_fixed),
        select(input_u.z, 0.0, secondary_wall_fixed),
        select(input_u.w, 0.0, tertiary_wall_fixed)
      );
      candidate_u.y = shared_u;
      if (primary_active) { candidate_u.x = shared_u; }
      if (secondary_active) { candidate_u.z = shared_u; }
      if (tertiary_active) { candidate_u.w = shared_u; }
      let candidate_residual = vec3<f32>(
        primary_contact_sign * (candidate_u.y - candidate_u.x),
        secondary_contact_sign * (candidate_u.y - candidate_u.z),
        tertiary_contact_sign * (candidate_u.y - candidate_u.w)
      );
      var contact_feasible = true;
      if (primary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.x >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.x) <= velocity_tolerance_m_per_s,
          primary_active
        );
      }
      if (secondary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.y >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.y) <= velocity_tolerance_m_per_s,
          secondary_active
        );
      }
      if (tertiary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.z >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.z) <= velocity_tolerance_m_per_s,
          tertiary_active
        );
      }
      if (!contact_feasible) { continue; }
      let pair_impulse = vec4<f32>(
        -primary_contact_sign * contact_lambda.x,
        primary_contact_sign * contact_lambda.x
          + secondary_contact_sign * contact_lambda.y
          + tertiary_contact_sign * contact_lambda.z,
        -secondary_contact_sign * contact_lambda.y,
        -tertiary_contact_sign * contact_lambda.z
      );
      let total_impulse = masses_kg * (candidate_u - input_u);
      let wall_impulse = total_impulse - pair_impulse;
      var wall_feasible = true;
      if (primary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.x) <= velocity_tolerance_m_per_s
          && primary_wall_constraint.inward_scalar_sign * wall_impulse.x
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.x) <= impulse_tolerance;
        if (primary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && primary_wall_constraint.inward_scalar_sign * candidate_u.x
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (center_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.y) <= velocity_tolerance_m_per_s
          && center_wall_constraint.inward_scalar_sign * wall_impulse.y
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.y) <= impulse_tolerance;
        if (center_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && center_wall_constraint.inward_scalar_sign * candidate_u.y
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (secondary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.z) <= velocity_tolerance_m_per_s
          && secondary_wall_constraint.inward_scalar_sign * wall_impulse.z
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.z) <= impulse_tolerance;
        if (secondary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && secondary_wall_constraint.inward_scalar_sign * candidate_u.z
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (tertiary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.w) <= velocity_tolerance_m_per_s
          && tertiary_wall_constraint.inward_scalar_sign * wall_impulse.w
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.w) <= impulse_tolerance;
        if (tertiary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && tertiary_wall_constraint.inward_scalar_sign * candidate_u.w
              >= -velocity_tolerance_m_per_s;
        }
      }
      let delta_u = candidate_u - input_u;
      let objective = dot(masses_kg, delta_u * delta_u);
      if (
        !wall_feasible
        || !mechanical_solver_finite(candidate_u.x)
        || !mechanical_solver_finite(candidate_u.y)
        || !mechanical_solver_finite(candidate_u.z)
        || !mechanical_solver_finite(candidate_u.w)
        || !mechanical_solver_finite3(candidate_residual)
        || !mechanical_solver_finite(wall_impulse.x)
        || !mechanical_solver_finite(wall_impulse.y)
        || !mechanical_solver_finite(wall_impulse.z)
        || !mechanical_solver_finite(wall_impulse.w)
        || !mechanical_solver_finite(objective)
      ) { continue; }
      if (result.valid == 0u || objective < result.objective) {
        result.velocity = candidate_u;
        result.contact_lambda = contact_lambda;
        result.objective = objective;
        result.contact_mask = contact_mask;
        result.wall_mask = wall_mask;
        result.valid = 1u;
      }
    }
  }
  return result;
}

fn mechanical_matching_four_wall_energy_allocation(
  wall_kinetic_delta_j: f32,
  masses_kg: vec4<f32>,
  wall_mask: u32,
  kinetic_tolerance_j: f32
) -> MechanicalMatchingFourWallEnergyAllocation {
  var result = MechanicalMatchingFourWallEnergyAllocation(
    vec4<f32>(0.0),
    1u
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(kinetic_tolerance_j)
  ) {
    result.valid = 0u;
    return result;
  }
  if (wall_mask == 0u) {
    if (abs(wall_kinetic_delta_j) > kinetic_tolerance_j) {
      result.valid = 0u;
    }
    return result;
  }
  let fixed_mass_kg =
    select(0.0, masses_kg.x, (wall_mask & 1u) != 0u)
      + select(0.0, masses_kg.y, (wall_mask & 2u) != 0u)
      + select(0.0, masses_kg.z, (wall_mask & 4u) != 0u)
      + select(0.0, masses_kg.w, (wall_mask & 8u) != 0u);
  if (!(fixed_mass_kg > 0.0) || !mechanical_solver_finite(fixed_mass_kg)) {
    result.valid = 0u;
    return result;
  }
  result.delta_j = vec4<f32>(
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.x / fixed_mass_kg,
      (wall_mask & 1u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.y / fixed_mass_kg,
      (wall_mask & 2u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.z / fixed_mass_kg,
      (wall_mask & 4u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.w / fixed_mass_kg,
      (wall_mask & 8u) != 0u
    )
  );
  return result;
}

fn mechanical_matching_four_block_box_wall_active_set(
  seed: MechanicalMatchingThreeBlockResult,
  primary_normal: vec3<f32>,
  secondary_normal: vec3<f32>,
  tertiary_normal: vec3<f32>,
  primary_pos_mass: vec4<f32>,
  center_pos_mass: vec4<f32>,
  secondary_pos_mass: vec4<f32>,
  tertiary_pos_mass: vec4<f32>,
  primary_velocity: vec3<f32>,
  center_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  tertiary_velocity: vec3<f32>,
  contact_primary_velocity: vec3<f32>,
  contact_center_velocity: vec3<f32>,
  contact_secondary_velocity: vec3<f32>,
  contact_tertiary_velocity: vec3<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  let masses_kg = vec4<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w,
    tertiary_pos_mass.w
  );
  let x_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(1.0, 0.0, 0.0),
    primary_normal.x,
    secondary_normal.x,
    tertiary_normal.x,
    masses_kg,
    vec4<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x,
      tertiary_velocity.x
    ),
    velocity_tolerance_m_per_s
  );
  let y_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(0.0, 1.0, 0.0),
    primary_normal.y,
    secondary_normal.y,
    tertiary_normal.y,
    masses_kg,
    vec4<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y,
      tertiary_velocity.y
    ),
    velocity_tolerance_m_per_s
  );
  let z_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(0.0, 0.0, 1.0),
    primary_normal.z,
    secondary_normal.z,
    tertiary_normal.z,
    masses_kg,
    vec4<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z,
      tertiary_velocity.z
    ),
    velocity_tolerance_m_per_s
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  let active_contact_mask = x_axis.contact_mask
    | y_axis.contact_mask
    | z_axis.contact_mask;
  if ((active_contact_mask & 7u) != 7u) { return result; }
  let resolved_primary_velocity = vec3<f32>(
    x_axis.velocity.x,
    y_axis.velocity.x,
    z_axis.velocity.x
  );
  let resolved_center_velocity = vec3<f32>(
    x_axis.velocity.y,
    y_axis.velocity.y,
    z_axis.velocity.y
  );
  let resolved_secondary_velocity = vec3<f32>(
    x_axis.velocity.z,
    y_axis.velocity.z,
    z_axis.velocity.z
  );
  let resolved_tertiary_velocity = vec3<f32>(
    x_axis.velocity.w,
    y_axis.velocity.w,
    z_axis.velocity.w
  );
  let primary_impulse = vec3<f32>(
    -primary_normal.x * x_axis.contact_lambda.x,
    -primary_normal.y * y_axis.contact_lambda.x,
    -primary_normal.z * z_axis.contact_lambda.x
  );
  let secondary_impulse = vec3<f32>(
    -secondary_normal.x * x_axis.contact_lambda.y,
    -secondary_normal.y * y_axis.contact_lambda.y,
    -secondary_normal.z * z_axis.contact_lambda.y
  );
  let tertiary_impulse = vec3<f32>(
    -tertiary_normal.x * x_axis.contact_lambda.z,
    -tertiary_normal.y * y_axis.contact_lambda.z,
    -tertiary_normal.z * z_axis.contact_lambda.z
  );
  let center_primary_impulse = -primary_impulse;
  let center_secondary_impulse = -secondary_impulse;
  let center_tertiary_impulse = -tertiary_impulse;
  let primary_residual = dot(
    resolved_center_velocity - resolved_primary_velocity,
    primary_normal
  );
  let secondary_residual = dot(
    resolved_center_velocity - resolved_secondary_velocity,
    secondary_normal
  );
  let tertiary_residual = dot(
    resolved_center_velocity - resolved_tertiary_velocity,
    tertiary_normal
  );
  let primary_contact_impulse = -dot(primary_impulse, primary_normal);
  let secondary_contact_impulse = -dot(
    secondary_impulse,
    secondary_normal
  );
  let tertiary_contact_impulse = -dot(
    tertiary_impulse,
    tertiary_normal
  );
  let impulse_conditioning = max(
    max(length(primary_impulse), length(secondary_impulse)),
    length(tertiary_impulse)
  );
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  let pair_momentum_residual = primary_impulse
    + center_primary_impulse
    + secondary_impulse
    + center_secondary_impulse
    + tertiary_impulse
    + center_tertiary_impulse;
  if (
    !mechanical_solver_finite3(resolved_primary_velocity)
    || !mechanical_solver_finite3(resolved_center_velocity)
    || !mechanical_solver_finite3(resolved_secondary_velocity)
    || !mechanical_solver_finite3(resolved_tertiary_velocity)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(tertiary_impulse)
    || !mechanical_solver_finite3(pair_momentum_residual)
    || !mechanical_solver_finite(primary_residual)
    || !mechanical_solver_finite(secondary_residual)
    || !mechanical_solver_finite(tertiary_residual)
    || primary_residual < -velocity_tolerance_m_per_s
    || secondary_residual < -velocity_tolerance_m_per_s
    || tertiary_residual < -velocity_tolerance_m_per_s
    || !(primary_contact_impulse > 0.0)
    || !(secondary_contact_impulse > 0.0)
    || !(tertiary_contact_impulse > 0.0)
    || length(primary_impulse
      + primary_contact_impulse * primary_normal) > impulse_tolerance
    || length(secondary_impulse
      + secondary_contact_impulse * secondary_normal) > impulse_tolerance
    || length(tertiary_impulse
      + tertiary_contact_impulse * tertiary_normal) > impulse_tolerance
    || length(pair_momentum_residual) > impulse_tolerance
  ) { return result; }
  let resolved_primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    resolved_primary_velocity,
    primary_pos_mass.w
  );
  let resolved_center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    resolved_center_velocity,
    center_pos_mass.w
  );
  let resolved_secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    resolved_secondary_velocity,
    secondary_pos_mass.w
  );
  let resolved_tertiary_wall = mechanical_matching_project_wall_velocity(
    seed.tertiary_index,
    tertiary_pos_mass.xyz,
    resolved_tertiary_velocity,
    tertiary_pos_mass.w
  );
  if (
    resolved_primary_wall.valid == 0u
    || resolved_center_wall.valid == 0u
    || resolved_secondary_wall.valid == 0u
    || resolved_tertiary_wall.valid == 0u
    || resolved_primary_wall.clipped != 0u
    || resolved_center_wall.clipped != 0u
    || resolved_secondary_wall.clipped != 0u
    || resolved_tertiary_wall.clipped != 0u
  ) { return result; }
  let primary_pair_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(contact_primary_velocity, contact_primary_velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_pair_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(contact_center_velocity, contact_center_velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_pair_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(contact_secondary_velocity, contact_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let tertiary_pair_kinetic_delta_j = 0.5 * tertiary_pos_mass.w * (
    dot(contact_tertiary_velocity, contact_tertiary_velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  );
  let pair_kinetic_delta_j = primary_pair_kinetic_delta_j
    + center_pair_kinetic_delta_j
    + secondary_pair_kinetic_delta_j
    + tertiary_pair_kinetic_delta_j;
  let wall_kinetic_delta_x_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.x * resolved_primary_velocity.x
      - contact_primary_velocity.x * contact_primary_velocity.x,
    resolved_center_velocity.x * resolved_center_velocity.x
      - contact_center_velocity.x * contact_center_velocity.x,
    resolved_secondary_velocity.x * resolved_secondary_velocity.x
      - contact_secondary_velocity.x * contact_secondary_velocity.x,
    resolved_tertiary_velocity.x * resolved_tertiary_velocity.x
      - contact_tertiary_velocity.x * contact_tertiary_velocity.x
  ));
  let wall_kinetic_delta_y_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.y * resolved_primary_velocity.y
      - contact_primary_velocity.y * contact_primary_velocity.y,
    resolved_center_velocity.y * resolved_center_velocity.y
      - contact_center_velocity.y * contact_center_velocity.y,
    resolved_secondary_velocity.y * resolved_secondary_velocity.y
      - contact_secondary_velocity.y * contact_secondary_velocity.y,
    resolved_tertiary_velocity.y * resolved_tertiary_velocity.y
      - contact_tertiary_velocity.y * contact_tertiary_velocity.y
  ));
  let wall_kinetic_delta_z_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.z * resolved_primary_velocity.z
      - contact_primary_velocity.z * contact_primary_velocity.z,
    resolved_center_velocity.z * resolved_center_velocity.z
      - contact_center_velocity.z * contact_center_velocity.z,
    resolved_secondary_velocity.z * resolved_secondary_velocity.z
      - contact_secondary_velocity.z * contact_secondary_velocity.z,
    resolved_tertiary_velocity.z * resolved_tertiary_velocity.z
      - contact_tertiary_velocity.z * contact_tertiary_velocity.z
  ));
  let wall_kinetic_delta_j = wall_kinetic_delta_x_j
    + wall_kinetic_delta_y_j
    + wall_kinetic_delta_z_j;
  let total_kinetic_delta_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(resolved_primary_velocity, resolved_primary_velocity)
      - dot(primary_velocity, primary_velocity),
    dot(resolved_center_velocity, resolved_center_velocity)
      - dot(center_velocity, center_velocity),
    dot(resolved_secondary_velocity, resolved_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity),
    dot(resolved_tertiary_velocity, resolved_tertiary_velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  ));
  let kinetic_conditioning_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(primary_velocity, primary_velocity)
      + dot(contact_primary_velocity, contact_primary_velocity)
      + dot(resolved_primary_velocity, resolved_primary_velocity),
    dot(center_velocity, center_velocity)
      + dot(contact_center_velocity, contact_center_velocity)
      + dot(resolved_center_velocity, resolved_center_velocity),
    dot(secondary_velocity, secondary_velocity)
      + dot(contact_secondary_velocity, contact_secondary_velocity)
      + dot(resolved_secondary_velocity, resolved_secondary_velocity),
    dot(tertiary_velocity, tertiary_velocity)
      + dot(contact_tertiary_velocity, contact_tertiary_velocity)
      + dot(resolved_tertiary_velocity, resolved_tertiary_velocity)
  ));
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  let x_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_x_j,
    masses_kg,
    x_axis.wall_mask,
    kinetic_tolerance_j
  );
  let y_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_y_j,
    masses_kg,
    y_axis.wall_mask,
    kinetic_tolerance_j
  );
  let z_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_z_j,
    masses_kg,
    z_axis.wall_mask,
    kinetic_tolerance_j
  );
  let wall_allocations = x_wall_allocation.delta_j
    + y_wall_allocation.delta_j
    + z_wall_allocation.delta_j;
  if (
    x_wall_allocation.valid == 0u
    || y_wall_allocation.valid == 0u
    || z_wall_allocation.valid == 0u
    || !mechanical_solver_finite(primary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(center_pair_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(tertiary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(pair_kinetic_delta_j)
    || !mechanical_solver_finite(wall_kinetic_delta_x_j)
    || !mechanical_solver_finite(wall_kinetic_delta_y_j)
    || !mechanical_solver_finite(wall_kinetic_delta_z_j)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(total_kinetic_delta_j)
    || !mechanical_solver_finite(wall_allocations.x)
    || !mechanical_solver_finite(wall_allocations.y)
    || !mechanical_solver_finite(wall_allocations.z)
    || !mechanical_solver_finite(wall_allocations.w)
    || pair_kinetic_delta_j > kinetic_tolerance_j
    || wall_kinetic_delta_x_j > kinetic_tolerance_j
    || wall_kinetic_delta_y_j > kinetic_tolerance_j
    || wall_kinetic_delta_z_j > kinetic_tolerance_j
    || wall_kinetic_delta_j > kinetic_tolerance_j
    || wall_allocations.x > kinetic_tolerance_j
    || wall_allocations.y > kinetic_tolerance_j
    || wall_allocations.z > kinetic_tolerance_j
    || wall_allocations.w > kinetic_tolerance_j
    || abs(total_kinetic_delta_j
      - pair_kinetic_delta_j
      - wall_kinetic_delta_j) > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = resolved_primary_velocity;
  result.center_velocity = resolved_center_velocity;
  result.secondary_velocity = resolved_secondary_velocity;
  result.tertiary_velocity = resolved_tertiary_velocity;
  result.primary_kinetic_delta_j = primary_pair_kinetic_delta_j;
  result.center_kinetic_delta_j = center_pair_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_pair_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = tertiary_pair_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = wall_allocations.x;
  result.center_wall_kinetic_delta_j = wall_allocations.y;
  result.secondary_wall_kinetic_delta_j = wall_allocations.z;
  result.tertiary_wall_kinetic_delta_j = wall_allocations.w;
  result.pair_heat_j = max(0.0, -pair_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = center_primary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.center_secondary_impulse = center_secondary_impulse;
  result.tertiary_impulse = tertiary_impulse;
  result.center_tertiary_impulse = center_tertiary_impulse;
  result.member_count = 4u;
  result.applied = 1u;
  return result;
}

// Merge two reciprocal matching edges joined by one previously processed
// bridge. The pair-level reciprocal choice gives exclusive ownership to the
// lexicographically later mutual pair. Besides making the production write
// race-free, that order lets the single-invocation diagnostic replay inspect
// the non-owner before the owner repurposes both pairs' selection scratch.
// This is the exact four-node path that a pairwise sweep otherwise contracts
// only by the small light/heavy mass ratio.
fn mechanical_matching_four_path_block(
  mutual_low: u32,
  mutual_high: u32,
  published_total: u32
) -> MechanicalMatchingThreeBlockResult {
  var result = mechanical_matching_zero_three_block();
  let candidate = mechanical_matching_four_path_candidate(
    mutual_low,
    mutual_high,
    published_total
  );
  if (candidate.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  if (candidate.found == 0u) { return result; }
  let edge_0_low = min(candidate.body_0_index, candidate.body_1_index);
  let edge_0_high = max(candidate.body_0_index, candidate.body_1_index);
  let edge_2_low = min(candidate.body_2_index, candidate.body_3_index);
  let edge_2_high = max(candidate.body_2_index, candidate.body_3_index);
  let current_is_edge_0 = mutual_low == edge_0_low
    && mutual_high == edge_0_high;
  let current_is_edge_2 = mutual_low == edge_2_low
    && mutual_high == edge_2_high;
  if (!current_is_edge_0 && !current_is_edge_2) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let partner_low = select(edge_0_low, edge_2_low, current_is_edge_0);
  let partner_high = select(edge_0_high, edge_2_high, current_is_edge_0);
  let reciprocal_candidate = mechanical_matching_four_path_candidate(
    partner_low,
    partner_high,
    published_total
  );
  if (reciprocal_candidate.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  if (
    reciprocal_candidate.found == 0u
    || reciprocal_candidate.body_0_index != candidate.body_0_index
    || reciprocal_candidate.body_1_index != candidate.body_1_index
    || reciprocal_candidate.body_2_index != candidate.body_2_index
    || reciprocal_candidate.body_3_index != candidate.body_3_index
    || reciprocal_candidate.edge_1_forward_cursor
      != candidate.edge_1_forward_cursor
    || reciprocal_candidate.edge_1_reverse_cursor
      != candidate.edge_1_reverse_cursor
  ) { return result; }
  result.primary_index = candidate.body_0_index;
  result.center_index = candidate.body_1_index;
  result.secondary_index = candidate.body_2_index;
  result.tertiary_index = candidate.body_3_index;
  result.center_primary_cursor = candidate.edge_0_forward_cursor;
  result.primary_center_cursor = candidate.edge_0_reverse_cursor;
  result.center_secondary_cursor = candidate.edge_1_forward_cursor;
  result.secondary_center_cursor = candidate.edge_1_reverse_cursor;
  // For topology 1 these two legacy carrier fields name the 2--3 edge.
  result.center_tertiary_cursor = candidate.edge_2_forward_cursor;
  result.tertiary_center_cursor = candidate.edge_2_reverse_cursor;
  result.block_found = 1u;
  result.member_count = 4u;
  result.topology = 1u;
  result.path_owner = select(0u, 1u, mutual_low > partner_low);
  if (
    candidate.edge_0_forward_cursor >= published_total
    || candidate.edge_0_reverse_cursor >= published_total
    || candidate.edge_1_forward_cursor >= published_total
    || candidate.edge_1_reverse_cursor >= published_total
    || candidate.edge_2_forward_cursor >= published_total
    || candidate.edge_2_reverse_cursor >= published_total
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_0_forward_cursor]
    ) != candidate.body_0_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_0_reverse_cursor]
    ) != candidate.body_1_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_1_forward_cursor]
    ) != candidate.body_2_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_1_reverse_cursor]
    ) != candidate.body_1_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_2_forward_cursor]
    ) != candidate.body_3_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_2_reverse_cursor]
    ) != candidate.body_2_index
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let edge_0_pair = mechanical_matching_constraint_pair(
    edge_0_low,
    edge_0_high,
    candidate.edge_0_forward_cursor
  );
  let edge_1_low = min(candidate.body_1_index, candidate.body_2_index);
  let edge_1_high = max(candidate.body_1_index, candidate.body_2_index);
  let edge_1_pair = mechanical_matching_constraint_pair(
    edge_1_low,
    edge_1_high,
    candidate.edge_1_forward_cursor
  );
  let edge_2_pair = mechanical_matching_constraint_pair(
    edge_2_low,
    edge_2_high,
    candidate.edge_2_forward_cursor
  );
  let edge_0_constraint =
    matching_constraints[candidate.edge_0_forward_cursor];
  let edge_0_reverse_constraint =
    matching_constraints[candidate.edge_0_reverse_cursor];
  let edge_1_constraint =
    matching_constraints[candidate.edge_1_forward_cursor];
  let edge_1_reverse_constraint =
    matching_constraints[candidate.edge_1_reverse_cursor];
  let edge_2_constraint =
    matching_constraints[candidate.edge_2_forward_cursor];
  let edge_2_reverse_constraint =
    matching_constraints[candidate.edge_2_reverse_cursor];
  if (
    edge_0_pair.valid == 0u
    || edge_1_pair.valid == 0u
    || edge_2_pair.valid == 0u
    || edge_0_pair.active_pair == 0u
    || edge_1_pair.active_pair == 0u
    || edge_2_pair.active_pair == 0u
    || edge_0_pair.unilateral == 0u
    || edge_1_pair.unilateral == 0u
    || edge_2_pair.unilateral == 0u
    || length(edge_0_constraint.xyz - edge_0_reverse_constraint.xyz)
      > 1.0e-5
    || length(edge_1_constraint.xyz - edge_1_reverse_constraint.xyz)
      > 1.0e-5
    || length(edge_2_constraint.xyz - edge_2_reverse_constraint.xyz)
      > 1.0e-5
    || edge_0_constraint.w != edge_0_reverse_constraint.w
    || edge_1_constraint.w != edge_1_reverse_constraint.w
    || edge_2_constraint.w != edge_2_reverse_constraint.w
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let body_0_pos_mass = input_state[candidate.body_0_index * 2u];
  let body_1_pos_mass = input_state[candidate.body_1_index * 2u];
  let body_2_pos_mass = input_state[candidate.body_2_index * 2u];
  let body_3_pos_mass = input_state[candidate.body_3_index * 2u];
  let body_0_velocity = input_state[candidate.body_0_index * 2u + 1u].xyz;
  let body_1_velocity = input_state[candidate.body_1_index * 2u + 1u].xyz;
  let body_2_velocity = input_state[candidate.body_2_index * 2u + 1u].xyz;
  let body_3_velocity = input_state[candidate.body_3_index * 2u + 1u].xyz;
  let masses_kg = vec4<f32>(
    body_0_pos_mass.w,
    body_1_pos_mass.w,
    body_2_pos_mass.w,
    body_3_pos_mass.w
  );
  if (
    !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite3(body_0_velocity)
    || !mechanical_solver_finite3(body_1_velocity)
    || !mechanical_solver_finite3(body_2_velocity)
    || !mechanical_solver_finite3(body_3_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let edge_0_normal = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_0_index,
    mechanical_matching_constraint_normal(edge_0_constraint)
  );
  let edge_1_normal = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_2_index,
    mechanical_matching_constraint_normal(edge_1_constraint)
  );
  let edge_2_normal = mechanical_matching_center_oriented_vector(
    candidate.body_2_index,
    candidate.body_3_index,
    mechanical_matching_constraint_normal(edge_2_constraint)
  );
  let edge_0_response = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_0_index,
    edge_0_constraint.xyz
  );
  let edge_1_response = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_2_index,
    edge_1_constraint.xyz
  );
  let edge_2_response = mechanical_matching_center_oriented_vector(
    candidate.body_2_index,
    candidate.body_3_index,
    edge_2_constraint.xyz
  );
  if (
    !mechanical_matching_axis_contact_normal_valid(edge_0_normal)
    || !mechanical_matching_axis_contact_normal_valid(edge_1_normal)
    || !mechanical_matching_axis_contact_normal_valid(edge_2_normal)
    || length(edge_0_response - edge_0_normal) > 1.0e-5
    || length(edge_1_response - edge_1_normal) > 1.0e-5
    || length(edge_2_response - edge_2_normal) > 1.0e-5
  ) { return result; }
  let edge_0_tolerance = mechanical_matching_position_tolerance(
    edge_0_low,
    edge_0_high
  );
  let edge_1_tolerance = mechanical_matching_position_tolerance(
    edge_1_low,
    edge_1_high
  );
  let edge_2_tolerance = mechanical_matching_position_tolerance(
    edge_2_low,
    edge_2_high
  );
  let edge_0_low_mass = input_state[edge_0_low * 2u].w;
  let edge_0_high_mass = input_state[edge_0_high * 2u].w;
  let edge_1_low_mass = input_state[edge_1_low * 2u].w;
  let edge_1_high_mass = input_state[edge_1_high * 2u].w;
  let edge_2_low_mass = input_state[edge_2_low * 2u].w;
  let edge_2_high_mass = input_state[edge_2_high * 2u].w;
  let edge_0_position_ratio = edge_0_pair.position_residual
    / edge_0_tolerance;
  let edge_1_position_ratio = edge_1_pair.position_residual
    / edge_1_tolerance;
  let edge_2_position_ratio = edge_2_pair.position_residual
    / edge_2_tolerance;
  let edge_0_update_ratio = length(edge_0_pair.barrier_dx)
    * (1.0 + edge_0_low_mass / edge_0_high_mass) / edge_0_tolerance;
  let edge_1_update_ratio = length(edge_1_pair.barrier_dx)
    * (1.0 + edge_1_low_mass / edge_1_high_mass) / edge_1_tolerance;
  let edge_2_update_ratio = length(edge_2_pair.barrier_dx)
    * (1.0 + edge_2_low_mass / edge_2_high_mass) / edge_2_tolerance;
  if (
    edge_0_position_ratio > 0.5
    || edge_1_position_ratio > 0.5
    || edge_2_position_ratio > 0.5
    || edge_0_update_ratio > 0.5
    || edge_1_update_ratio > 0.5
    || edge_2_update_ratio > 0.5
  ) { return result; }
  let x_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.x,
    edge_1_normal.x,
    edge_2_normal.x,
    masses_kg,
    vec4<f32>(
      body_0_velocity.x,
      body_1_velocity.x,
      body_2_velocity.x,
      body_3_velocity.x
    ),
    1.0e-5
  );
  let y_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.y,
    edge_1_normal.y,
    edge_2_normal.y,
    masses_kg,
    vec4<f32>(
      body_0_velocity.y,
      body_1_velocity.y,
      body_2_velocity.y,
      body_3_velocity.y
    ),
    1.0e-5
  );
  let z_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.z,
    edge_1_normal.z,
    edge_2_normal.z,
    masses_kg,
    vec4<f32>(
      body_0_velocity.z,
      body_1_velocity.z,
      body_2_velocity.z,
      body_3_velocity.z
    ),
    1.0e-5
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  if (
    ((x_axis.contact_mask | y_axis.contact_mask | z_axis.contact_mask) & 7u)
      != 7u
  ) { return result; }
  let body_0_resolved_velocity = vec3<f32>(
    x_axis.velocity.x,
    y_axis.velocity.x,
    z_axis.velocity.x
  );
  let body_1_resolved_velocity = vec3<f32>(
    x_axis.velocity.y,
    y_axis.velocity.y,
    z_axis.velocity.y
  );
  let body_2_resolved_velocity = vec3<f32>(
    x_axis.velocity.z,
    y_axis.velocity.z,
    z_axis.velocity.z
  );
  let body_3_resolved_velocity = vec3<f32>(
    x_axis.velocity.w,
    y_axis.velocity.w,
    z_axis.velocity.w
  );
  let edge_0_residual = dot(
    body_1_resolved_velocity - body_0_resolved_velocity,
    edge_0_normal
  );
  let edge_1_residual = dot(
    body_1_resolved_velocity - body_2_resolved_velocity,
    edge_1_normal
  );
  let edge_2_residual = dot(
    body_2_resolved_velocity - body_3_resolved_velocity,
    edge_2_normal
  );
  if (
    edge_0_residual < -1.0e-5
    || edge_1_residual < -1.0e-5
    || edge_2_residual < -1.0e-5
  ) { return result; }
  let body_0_wall = mechanical_matching_project_wall_velocity(
    candidate.body_0_index,
    body_0_pos_mass.xyz,
    body_0_resolved_velocity,
    body_0_pos_mass.w
  );
  let body_1_wall = mechanical_matching_project_wall_velocity(
    candidate.body_1_index,
    body_1_pos_mass.xyz,
    body_1_resolved_velocity,
    body_1_pos_mass.w
  );
  let body_2_wall = mechanical_matching_project_wall_velocity(
    candidate.body_2_index,
    body_2_pos_mass.xyz,
    body_2_resolved_velocity,
    body_2_pos_mass.w
  );
  let body_3_wall = mechanical_matching_project_wall_velocity(
    candidate.body_3_index,
    body_3_pos_mass.xyz,
    body_3_resolved_velocity,
    body_3_pos_mass.w
  );
  if (
    body_0_wall.valid == 0u
    || body_1_wall.valid == 0u
    || body_2_wall.valid == 0u
    || body_3_wall.valid == 0u
    || body_0_wall.clipped != 0u
    || body_1_wall.clipped != 0u
    || body_2_wall.clipped != 0u
    || body_3_wall.clipped != 0u
  ) { return result; }
  let body_0_impulse = body_0_pos_mass.w
    * (body_0_wall.velocity - body_0_velocity);
  let body_1_impulse = body_1_pos_mass.w
    * (body_1_wall.velocity - body_1_velocity);
  let body_2_impulse = body_2_pos_mass.w
    * (body_2_wall.velocity - body_2_velocity);
  let body_3_impulse = body_3_pos_mass.w
    * (body_3_wall.velocity - body_3_velocity);
  let edge_0_lambda = -dot(body_0_impulse, edge_0_normal);
  let edge_2_lambda = -dot(body_3_impulse, edge_2_normal);
  let edge_0_body_1_impulse = edge_0_lambda * edge_0_normal;
  let edge_1_lambda = dot(
    body_1_impulse - edge_0_body_1_impulse,
    edge_1_normal
  );
  let edge_1_body_1_impulse = edge_1_lambda * edge_1_normal;
  let edge_1_body_2_impulse = -edge_1_body_1_impulse;
  let edge_2_body_2_impulse = edge_2_lambda * edge_2_normal;
  let edge_0_body_0_impulse = -edge_0_body_1_impulse;
  let edge_2_body_3_impulse = -edge_2_body_2_impulse;
  let impulse_conditioning = length(body_0_impulse)
    + length(body_1_impulse)
    + length(body_2_impulse)
    + length(body_3_impulse);
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !(edge_0_lambda > 0.0)
    || !(edge_1_lambda > 0.0)
    || !(edge_2_lambda > 0.0)
    || length(body_0_impulse - edge_0_body_0_impulse)
      > impulse_tolerance
    || length(
      body_1_impulse
        - edge_0_body_1_impulse
        - edge_1_body_1_impulse
    ) > impulse_tolerance
    || length(
      body_2_impulse
        - edge_1_body_2_impulse
        - edge_2_body_2_impulse
    ) > impulse_tolerance
    || length(body_3_impulse - edge_2_body_3_impulse)
      > impulse_tolerance
    || length(
      body_0_impulse + body_1_impulse
        + body_2_impulse + body_3_impulse
    ) > impulse_tolerance
  ) { return result; }
  let body_0_kinetic_delta_j = 0.5 * body_0_pos_mass.w * (
    dot(body_0_wall.velocity, body_0_wall.velocity)
      - dot(body_0_velocity, body_0_velocity)
  );
  let body_1_kinetic_delta_j = 0.5 * body_1_pos_mass.w * (
    dot(body_1_wall.velocity, body_1_wall.velocity)
      - dot(body_1_velocity, body_1_velocity)
  );
  let body_2_kinetic_delta_j = 0.5 * body_2_pos_mass.w * (
    dot(body_2_wall.velocity, body_2_wall.velocity)
      - dot(body_2_velocity, body_2_velocity)
  );
  let body_3_kinetic_delta_j = 0.5 * body_3_pos_mass.w * (
    dot(body_3_wall.velocity, body_3_wall.velocity)
      - dot(body_3_velocity, body_3_velocity)
  );
  let aggregate_kinetic_delta_j = body_0_kinetic_delta_j
    + body_1_kinetic_delta_j
    + body_2_kinetic_delta_j
    + body_3_kinetic_delta_j;
  let kinetic_conditioning_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(body_0_velocity, body_0_velocity)
      + dot(body_0_wall.velocity, body_0_wall.velocity),
    dot(body_1_velocity, body_1_velocity)
      + dot(body_1_wall.velocity, body_1_wall.velocity),
    dot(body_2_velocity, body_2_velocity)
      + dot(body_2_wall.velocity, body_2_wall.velocity),
    dot(body_3_velocity, body_3_velocity)
      + dot(body_3_wall.velocity, body_3_wall.velocity)
  ));
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = body_0_wall.velocity;
  result.center_velocity = body_1_wall.velocity;
  result.secondary_velocity = body_2_wall.velocity;
  result.tertiary_velocity = body_3_wall.velocity;
  result.primary_kinetic_delta_j = body_0_kinetic_delta_j;
  result.center_kinetic_delta_j = body_1_kinetic_delta_j;
  result.secondary_kinetic_delta_j = body_2_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = body_3_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = body_0_wall.kinetic_delta_j;
  result.center_wall_kinetic_delta_j = body_1_wall.kinetic_delta_j;
  result.secondary_wall_kinetic_delta_j = body_2_wall.kinetic_delta_j;
  result.tertiary_wall_kinetic_delta_j = body_3_wall.kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = edge_0_body_0_impulse;
  result.center_primary_impulse = edge_0_body_1_impulse;
  result.center_secondary_impulse = edge_1_body_1_impulse;
  result.secondary_impulse = edge_1_body_2_impulse;
  result.center_tertiary_impulse = edge_2_body_2_impulse;
  result.tertiary_impulse = edge_2_body_3_impulse;
  result.applied = 1u;
  return result;
}

// Extend the proven three-body helper only for the degree-three contact star.
// Contact-only cases use the lighter eight-mask projection; wall-coupled
// cases use the exact 16 x 8 per-axis active set above.
fn mechanical_matching_four_block(
  seed: MechanicalMatchingThreeBlockResult,
  primary_pair: MechanicalPairResidual,
  secondary_pair: MechanicalPairResidual,
  tertiary_pair: MechanicalPairResidual
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  if (
    seed.center_index >= mechanical_params.particle_count
    || seed.primary_index >= mechanical_params.particle_count
    || seed.secondary_index >= mechanical_params.particle_count
    || seed.tertiary_index >= mechanical_params.particle_count
    || seed.center_index == seed.primary_index
    || seed.center_index == seed.secondary_index
    || seed.center_index == seed.tertiary_index
    || seed.primary_index == seed.secondary_index
    || seed.primary_index == seed.tertiary_index
    || seed.secondary_index == seed.tertiary_index
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let primary_pos_mass = input_state[seed.primary_index * 2u];
  let center_pos_mass = input_state[seed.center_index * 2u];
  let secondary_pos_mass = input_state[seed.secondary_index * 2u];
  let tertiary_pos_mass = input_state[seed.tertiary_index * 2u];
  if (
    !(primary_pos_mass.w > center_pos_mass.w)
    || !(secondary_pos_mass.w > center_pos_mass.w)
    || !(tertiary_pos_mass.w > center_pos_mass.w)
    || !(center_pos_mass.w > 0.0)
    || !mechanical_solver_finite3(primary_pos_mass.xyz)
    || !mechanical_solver_finite3(center_pos_mass.xyz)
    || !mechanical_solver_finite3(secondary_pos_mass.xyz)
    || !mechanical_solver_finite3(tertiary_pos_mass.xyz)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let center_primary_constraint =
    matching_constraints[seed.center_primary_cursor];
  let primary_center_constraint =
    matching_constraints[seed.primary_center_cursor];
  let center_secondary_constraint =
    matching_constraints[seed.center_secondary_cursor];
  let secondary_center_constraint =
    matching_constraints[seed.secondary_center_cursor];
  let center_tertiary_constraint =
    matching_constraints[seed.center_tertiary_cursor];
  let tertiary_center_constraint =
    matching_constraints[seed.tertiary_center_cursor];
  if (
    primary_pair.valid == 0u
    || secondary_pair.valid == 0u
    || tertiary_pair.valid == 0u
    || primary_pair.active_pair == 0u
    || secondary_pair.active_pair == 0u
    || tertiary_pair.active_pair == 0u
    || primary_pair.unilateral == 0u
    || secondary_pair.unilateral == 0u
    || tertiary_pair.unilateral == 0u
    || length(
      center_primary_constraint.xyz - primary_center_constraint.xyz
    ) > 1.0e-5
    || length(
      center_secondary_constraint.xyz - secondary_center_constraint.xyz
    ) > 1.0e-5
    || length(
      center_tertiary_constraint.xyz - tertiary_center_constraint.xyz
    ) > 1.0e-5
    || center_primary_constraint.w != primary_center_constraint.w
    || center_secondary_constraint.w != secondary_center_constraint.w
    || center_tertiary_constraint.w != tertiary_center_constraint.w
    || !mechanical_matching_constraint_code_valid(
      center_primary_constraint
    )
    || !mechanical_matching_constraint_code_valid(
      center_secondary_constraint
    )
    || !mechanical_matching_constraint_code_valid(
      center_tertiary_constraint
    )
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.primary_index,
    mechanical_matching_constraint_normal(center_primary_constraint)
  );
  let secondary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.secondary_index,
    mechanical_matching_constraint_normal(center_secondary_constraint)
  );
  let tertiary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.tertiary_index,
    mechanical_matching_constraint_normal(center_tertiary_constraint)
  );
  let primary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.primary_index,
    center_primary_constraint.xyz
  );
  let secondary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.secondary_index,
    center_secondary_constraint.xyz
  );
  let tertiary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.tertiary_index,
    center_tertiary_constraint.xyz
  );
  if (
    !mechanical_matching_axis_contact_normal_valid(primary_normal)
    || !mechanical_matching_axis_contact_normal_valid(secondary_normal)
    || !mechanical_matching_axis_contact_normal_valid(tertiary_normal)
    || !mechanical_solver_finite3(primary_response)
    || !mechanical_solver_finite3(secondary_response)
    || !mechanical_solver_finite3(tertiary_response)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    length(primary_response - primary_normal) > 1.0e-5
    || length(secondary_response - secondary_normal) > 1.0e-5
    || length(tertiary_response - tertiary_normal) > 1.0e-5
    || dot(primary_response, primary_normal) <= 1.0e-6
    || dot(secondary_response, secondary_normal) <= 1.0e-6
    || dot(tertiary_response, tertiary_normal) <= 1.0e-6
  ) { return seed; }
  let primary_low = min(seed.center_index, seed.primary_index);
  let primary_high = max(seed.center_index, seed.primary_index);
  let secondary_low = min(seed.center_index, seed.secondary_index);
  let secondary_high = max(seed.center_index, seed.secondary_index);
  let tertiary_low = min(seed.center_index, seed.tertiary_index);
  let tertiary_high = max(seed.center_index, seed.tertiary_index);
  let primary_tolerance =
    mechanical_matching_position_tolerance(primary_low, primary_high);
  let secondary_tolerance =
    mechanical_matching_position_tolerance(secondary_low, secondary_high);
  let tertiary_tolerance =
    mechanical_matching_position_tolerance(tertiary_low, tertiary_high);
  let primary_low_mass = input_state[primary_low * 2u].w;
  let primary_high_mass = input_state[primary_high * 2u].w;
  let secondary_low_mass = input_state[secondary_low * 2u].w;
  let secondary_high_mass = input_state[secondary_high * 2u].w;
  let tertiary_low_mass = input_state[tertiary_low * 2u].w;
  let tertiary_high_mass = input_state[tertiary_high * 2u].w;
  let primary_position_ratio =
    primary_pair.position_residual / primary_tolerance;
  let secondary_position_ratio =
    secondary_pair.position_residual / secondary_tolerance;
  let tertiary_position_ratio =
    tertiary_pair.position_residual / tertiary_tolerance;
  let primary_update_ratio = length(primary_pair.barrier_dx)
    * (1.0 + primary_low_mass / primary_high_mass)
    / primary_tolerance;
  let secondary_update_ratio = length(secondary_pair.barrier_dx)
    * (1.0 + secondary_low_mass / secondary_high_mass)
    / secondary_tolerance;
  let tertiary_update_ratio = length(tertiary_pair.barrier_dx)
    * (1.0 + tertiary_low_mass / tertiary_high_mass)
    / tertiary_tolerance;
  if (
    !mechanical_solver_finite(primary_position_ratio)
    || !mechanical_solver_finite(secondary_position_ratio)
    || !mechanical_solver_finite(tertiary_position_ratio)
    || !mechanical_solver_finite(primary_update_ratio)
    || !mechanical_solver_finite(secondary_update_ratio)
    || !mechanical_solver_finite(tertiary_update_ratio)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_position_ratio > 0.5
    || secondary_position_ratio > 0.5
    || tertiary_position_ratio > 0.5
    || primary_update_ratio > 0.5
    || secondary_update_ratio > 0.5
    || tertiary_update_ratio > 0.5
  ) { return seed; }
  let primary_velocity = input_state[seed.primary_index * 2u + 1u].xyz;
  let center_velocity = input_state[seed.center_index * 2u + 1u].xyz;
  let secondary_velocity =
    input_state[seed.secondary_index * 2u + 1u].xyz;
  let tertiary_velocity =
    input_state[seed.tertiary_index * 2u + 1u].xyz;
  let primary_relative_velocity = dot(
    center_velocity - primary_velocity,
    primary_normal
  );
  if (
    !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite3(tertiary_velocity)
    || !mechanical_solver_finite(primary_relative_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (!(primary_relative_velocity < -1.0e-5)) { return seed; }
  let masses_kg = vec4<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w,
    tertiary_pos_mass.w
  );
  let x_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.x,
    secondary_normal.x,
    tertiary_normal.x,
    masses_kg,
    vec4<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x,
      tertiary_velocity.x
    ),
    1.0e-5
  );
  let y_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.y,
    secondary_normal.y,
    tertiary_normal.y,
    masses_kg,
    vec4<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y,
      tertiary_velocity.y
    ),
    1.0e-5
  );
  let z_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.z,
    secondary_normal.z,
    tertiary_normal.z,
    masses_kg,
    vec4<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z,
      tertiary_velocity.z
    ),
    1.0e-5
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let active_contact_mask = x_axis.contact_mask
    | y_axis.contact_mask
    | z_axis.contact_mask;
  if ((active_contact_mask & 7u) != 7u) { return seed; }
  let proposed_primary_velocity =
    vec3<f32>(x_axis.velocity.x, y_axis.velocity.x, z_axis.velocity.x);
  let proposed_center_velocity =
    vec3<f32>(x_axis.velocity.y, y_axis.velocity.y, z_axis.velocity.y);
  let proposed_secondary_velocity =
    vec3<f32>(x_axis.velocity.z, y_axis.velocity.z, z_axis.velocity.z);
  let proposed_tertiary_velocity =
    vec3<f32>(x_axis.velocity.w, y_axis.velocity.w, z_axis.velocity.w);
  let primary_residual = dot(
    proposed_center_velocity - proposed_primary_velocity,
    primary_normal
  );
  let secondary_residual = dot(
    proposed_center_velocity - proposed_secondary_velocity,
    secondary_normal
  );
  let tertiary_residual = dot(
    proposed_center_velocity - proposed_tertiary_velocity,
    tertiary_normal
  );
  if (
    !mechanical_solver_finite3(proposed_primary_velocity)
    || !mechanical_solver_finite3(proposed_center_velocity)
    || !mechanical_solver_finite3(proposed_secondary_velocity)
    || !mechanical_solver_finite3(proposed_tertiary_velocity)
    || !mechanical_solver_finite(primary_residual)
    || !mechanical_solver_finite(secondary_residual)
    || !mechanical_solver_finite(tertiary_residual)
    || primary_residual < -1.0e-5
    || secondary_residual < -1.0e-5
    || tertiary_residual < -1.0e-5
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    proposed_primary_velocity,
    primary_pos_mass.w
  );
  let center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    proposed_center_velocity,
    center_pos_mass.w
  );
  let secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    proposed_secondary_velocity,
    secondary_pos_mass.w
  );
  let tertiary_wall = mechanical_matching_project_wall_velocity(
    seed.tertiary_index,
    tertiary_pos_mass.xyz,
    proposed_tertiary_velocity,
    tertiary_pos_mass.w
  );
  if (
    primary_wall.valid == 0u
    || center_wall.valid == 0u
    || secondary_wall.valid == 0u
    || tertiary_wall.valid == 0u
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_wall.clipped != 0u
    || center_wall.clipped != 0u
    || secondary_wall.clipped != 0u
    || tertiary_wall.clipped != 0u
  ) {
    return mechanical_matching_four_block_box_wall_active_set(
      seed,
      primary_normal,
      secondary_normal,
      tertiary_normal,
      primary_pos_mass,
      center_pos_mass,
      secondary_pos_mass,
      tertiary_pos_mass,
      primary_velocity,
      center_velocity,
      secondary_velocity,
      tertiary_velocity,
      proposed_primary_velocity,
      proposed_center_velocity,
      proposed_secondary_velocity,
      proposed_tertiary_velocity,
      1.0e-5
    );
  }
  let primary_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(primary_wall.velocity, primary_wall.velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(center_wall.velocity, center_wall.velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(secondary_wall.velocity, secondary_wall.velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let tertiary_kinetic_delta_j = 0.5 * tertiary_pos_mass.w * (
    dot(tertiary_wall.velocity, tertiary_wall.velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  );
  let primary_impulse = primary_pos_mass.w
    * (primary_wall.velocity - primary_velocity);
  let center_impulse = center_pos_mass.w
    * (center_wall.velocity - center_velocity);
  let secondary_impulse = secondary_pos_mass.w
    * (secondary_wall.velocity - secondary_velocity);
  let tertiary_impulse = tertiary_pos_mass.w
    * (tertiary_wall.velocity - tertiary_velocity);
  let primary_contact_impulse = -dot(primary_impulse, primary_normal);
  let secondary_contact_impulse = -dot(
    secondary_impulse,
    secondary_normal
  );
  let tertiary_contact_impulse = -dot(
    tertiary_impulse,
    tertiary_normal
  );
  let impulse_conditioning = max(
    max(length(primary_impulse), length(secondary_impulse)),
    length(tertiary_impulse)
  );
  let impulse_tolerance = max(
    1.0e-10,
    128.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !(primary_contact_impulse > 0.0)
    || !(secondary_contact_impulse > 0.0)
    || !(tertiary_contact_impulse > 0.0)
    || length(
      primary_impulse + primary_contact_impulse * primary_normal
    ) > impulse_tolerance
    || length(
      secondary_impulse + secondary_contact_impulse * secondary_normal
    ) > impulse_tolerance
    || length(
      tertiary_impulse + tertiary_contact_impulse * tertiary_normal
    ) > impulse_tolerance
  ) { return seed; }
  let aggregate_kinetic_delta_j = primary_kinetic_delta_j
    + center_kinetic_delta_j
    + secondary_kinetic_delta_j
    + tertiary_kinetic_delta_j;
  let aggregate_momentum_residual = primary_impulse
    + center_impulse
    + secondary_impulse
    + tertiary_impulse;
  let momentum_conditioning = length(primary_impulse)
    + length(center_impulse)
    + length(secondary_impulse)
    + length(tertiary_impulse);
  let momentum_tolerance = max(
    1.0e-6,
    256.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_pos_mass.w * (
      dot(primary_velocity, primary_velocity)
        + dot(primary_wall.velocity, primary_wall.velocity)
    )
      + center_pos_mass.w * (
        dot(center_velocity, center_velocity)
          + dot(center_wall.velocity, center_wall.velocity)
      )
      + secondary_pos_mass.w * (
        dot(secondary_velocity, secondary_velocity)
          + dot(secondary_wall.velocity, secondary_wall.velocity)
      )
      + tertiary_pos_mass.w * (
        dot(tertiary_velocity, tertiary_velocity)
          + dot(tertiary_wall.velocity, tertiary_wall.velocity)
      )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(primary_kinetic_delta_j)
    || !mechanical_solver_finite(center_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_kinetic_delta_j)
    || !mechanical_solver_finite(tertiary_kinetic_delta_j)
    || !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(center_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(tertiary_impulse)
    || !mechanical_solver_finite3(aggregate_momentum_residual)
    || length(aggregate_momentum_residual) > momentum_tolerance
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      mechanical_solver_finite(aggregate_kinetic_delta_j)
        && aggregate_kinetic_delta_j > kinetic_tolerance_j
    );
    result.valid = 0u;
    return result;
  }
  result.primary_velocity = primary_wall.velocity;
  result.center_velocity = center_wall.velocity;
  result.secondary_velocity = secondary_wall.velocity;
  result.tertiary_velocity = tertiary_wall.velocity;
  result.primary_kinetic_delta_j = primary_kinetic_delta_j;
  result.center_kinetic_delta_j = center_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = tertiary_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = primary_wall.kinetic_delta_j;
  result.center_wall_kinetic_delta_j = center_wall.kinetic_delta_j;
  result.secondary_wall_kinetic_delta_j = secondary_wall.kinetic_delta_j;
  result.tertiary_wall_kinetic_delta_j = tertiary_wall.kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = -primary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.center_secondary_impulse = -secondary_impulse;
  result.tertiary_impulse = tertiary_impulse;
  result.center_tertiary_impulse = -tertiary_impulse;
  result.member_count = 4u;
  result.applied = 1u;
  return result;
}

// A lighter carrier constrained by heavier peers is a coupled star, not a
// sequence of independent pair projections. Detect the race-free selection
// shape rooted at one mutual primary edge, retain the top two deterministic
// inbound selectors, and attempt the four-body projection before the proven
// three-body fallback. This helper is shared by production and diagnostic
// replay and intentionally performs no storage writes or atomics.
fn mechanical_matching_three_block(
  mutual_low: u32,
  mutual_high: u32,
  low_cursor: u32,
  high_cursor: u32,
  published_total: u32
) -> MechanicalMatchingThreeBlockResult {
  var result = mechanical_matching_zero_three_block();
  if (
    mutual_low >= mutual_high
    || mutual_high >= mechanical_params.particle_count
    || published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let low_begin = source_offsets[mutual_low];
  let low_end = source_offsets[mutual_low + 1u];
  let high_begin = source_offsets[mutual_high];
  let high_end = source_offsets[mutual_high + 1u];
  if (
    low_begin > low_end
    || high_begin > high_end
    || low_end > published_total
    || high_end > published_total
    || low_cursor < low_begin
    || low_cursor >= low_end
    || high_cursor < high_begin
    || high_cursor >= high_end
    || mechanical_solver_peer_index(csr_peers[low_cursor]) != mutual_high
    || mechanical_solver_peer_index(csr_peers[high_cursor]) != mutual_low
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let low_constraint = matching_constraints[low_cursor];
  let high_constraint = matching_constraints[high_cursor];
  let primary_pair = mechanical_matching_constraint_pair(
    mutual_low,
    mutual_high,
    low_cursor
  );
  if (
    primary_pair.valid == 0u
    || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
    || !mechanical_matching_constraint_code_valid(low_constraint)
    || !mechanical_matching_constraint_code_valid(high_constraint)
    || low_constraint.w != high_constraint.w
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (primary_pair.active_pair == 0u || primary_pair.unilateral == 0u) {
    return result;
  }
  let low_pos_mass = input_state[mutual_low * 2u];
  let high_pos_mass = input_state[mutual_high * 2u];
  if (
    !(low_pos_mass.w > 0.0)
    || !(high_pos_mass.w > 0.0)
    || !mechanical_solver_finite3(low_pos_mass.xyz)
    || !mechanical_solver_finite3(high_pos_mass.xyz)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (low_pos_mass.w == high_pos_mass.w) { return result; }
  let center_is_low = low_pos_mass.w < high_pos_mass.w;
  let center_index = select(mutual_high, mutual_low, center_is_low);
  let primary_index = select(mutual_low, mutual_high, center_is_low);
  let center_pos_mass = select(high_pos_mass, low_pos_mass, center_is_low);
  let primary_pos_mass = select(low_pos_mass, high_pos_mass, center_is_low);
  let center_primary_cursor = select(
    high_cursor,
    low_cursor,
    center_is_low
  );
  let primary_center_cursor = select(
    low_cursor,
    high_cursor,
    center_is_low
  );
  result.center_index = center_index;
  result.primary_index = primary_index;
  result.center_primary_cursor = center_primary_cursor;
  result.primary_center_cursor = primary_center_cursor;
  // The exact active-set projection below is valid for every positive mass
  // triple. Mass only orients ownership around one strictly lighter center;
  // a ratio threshold would strand otherwise solvable unequal-mass blocks.
  if (primary_pos_mass.w <= center_pos_mass.w) { return result; }

  let center_begin = source_offsets[center_index];
  let center_end = source_offsets[center_index + 1u];
  if (center_begin > center_end || center_end > published_total) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  var eligible_inbound_count = 0u;
  var secondary_index = 0xffffffffu;
  var center_secondary_cursor = 0xffffffffu;
  var secondary_center_cursor = 0xffffffffu;
  var secondary_pair = mechanical_solver_zero_pair(1u);
  var secondary_priority = -1.0;
  var secondary_face_alignment = 0.0;
  var secondary_rank = 0xffffffffu;
  var secondary_order_low = 0xffffffffu;
  var secondary_order_high = 0xffffffffu;
  var tertiary_index = 0xffffffffu;
  var center_tertiary_cursor = 0xffffffffu;
  var tertiary_center_cursor = 0xffffffffu;
  var tertiary_pair = mechanical_solver_zero_pair(1u);
  var tertiary_priority = -1.0;
  var tertiary_face_alignment = 0.0;
  var tertiary_rank = 0xffffffffu;
  var tertiary_order_low = 0xffffffffu;
  var tertiary_order_high = 0xffffffffu;
  for (
    var cursor = center_begin;
    cursor < center_end;
    cursor = cursor + 1u
  ) {
    let candidate_index =
      mechanical_solver_peer_index(csr_peers[cursor]);
    if (
      candidate_index == primary_index
      || candidate_index >= mechanical_params.particle_count
    ) { continue; }
    let candidate_selection =
      energy_ledger[mechanical_energy_base(candidate_index)];
    let candidate_selected_peer = bitcast<u32>(candidate_selection.x);
    var candidate_cursor = bitcast<u32>(candidate_selection.z);
    var uses_independent_reservation = false;
    if (candidate_selected_peer != center_index) {
      candidate_cursor = bitcast<u32>(candidate_selection.w);
      uses_independent_reservation = true;
      // A vertex in another reciprocal primary match is owned by that match
      // for this pass.  A merely non-reciprocal ordinary selection performs no
      // write, so its independently published inactive support remains safe
      // for this center's coupled block.
      if (candidate_selected_peer < mechanical_params.particle_count) {
        let selected_peer_selection = energy_ledger[
          mechanical_energy_base(candidate_selected_peer)
        ];
        if (bitcast<u32>(selected_peer_selection.x) == candidate_index) {
          continue;
        }
      }
    }
    let candidate_begin = source_offsets[candidate_index];
    let candidate_end = source_offsets[candidate_index + 1u];
    if (
      candidate_begin > candidate_end
      || candidate_end > published_total
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
      result.valid = 0u;
      return result;
    }
    let candidate_cursor_valid = candidate_cursor >= candidate_begin
      && candidate_cursor < candidate_end
      && mechanical_solver_peer_index(csr_peers[candidate_cursor])
        == center_index;
    if (!candidate_cursor_valid) {
      if (uses_independent_reservation) { continue; }
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
      result.valid = 0u;
      return result;
    }
    if (
      uses_independent_reservation
      && (
        !mechanical_solver_edge_inactive(csr_peers[cursor])
        || !mechanical_solver_edge_inactive(csr_peers[candidate_cursor])
      )
    ) { continue; }
    let candidate_pos_mass = input_state[candidate_index * 2u];
    if (
      !(candidate_pos_mass.w > 0.0)
      || !mechanical_solver_finite3(candidate_pos_mass.xyz)
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    if (candidate_pos_mass.w <= center_pos_mass.w) { continue; }
    let candidate_pair = mechanical_matching_constraint_pair(
      min(center_index, candidate_index),
      max(center_index, candidate_index),
      cursor
    );
    let center_constraint = matching_constraints[cursor];
    let candidate_constraint = matching_constraints[candidate_cursor];
    if (
      candidate_pair.valid == 0u
      || length(center_constraint.xyz - candidate_constraint.xyz) > 1.0e-5
      || !mechanical_matching_constraint_code_valid(center_constraint)
      || !mechanical_matching_constraint_code_valid(candidate_constraint)
      || center_constraint.w != candidate_constraint.w
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    if (
      candidate_pair.active_pair == 0u
      || candidate_pair.unilateral == 0u
    ) { continue; }
    let candidate_low = min(center_index, candidate_index);
    let candidate_high = max(center_index, candidate_index);
    let candidate_low_mass = input_state[candidate_low * 2u].w;
    let candidate_high_mass = input_state[candidate_high * 2u].w;
    let candidate_position_tolerance =
      mechanical_matching_position_tolerance(
        candidate_low,
        candidate_high
      );
    let candidate_position_ratio = candidate_pair.position_residual
      / candidate_position_tolerance;
    let candidate_position_update_ratio = length(candidate_pair.barrier_dx)
      * (1.0 + candidate_low_mass / max(candidate_high_mass, 1.0e-30))
      / candidate_position_tolerance;
    let candidate_velocity_ratio = candidate_pair.velocity_residual / ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
    let candidate_priority = max(
      max(candidate_position_ratio, candidate_position_update_ratio),
      candidate_velocity_ratio
    );
    let candidate_rank = mechanical_matching_edge_rank(
      candidate_low,
      candidate_high
    );
    let candidate_normal = mechanical_matching_constraint_normal(
      center_constraint
    );
    let candidate_face_alignment = max(
      abs(candidate_normal.x),
      max(abs(candidate_normal.y), abs(candidate_normal.z))
    );
    if (
      !mechanical_solver_finite(candidate_priority)
      || !mechanical_solver_finite3(candidate_normal)
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    let secondary_better = mechanical_matching_inbound_candidate_better(
      candidate_priority,
      candidate_face_alignment,
      candidate_rank,
      candidate_low,
      candidate_high,
      secondary_priority,
      secondary_face_alignment,
      secondary_rank,
      secondary_order_low,
      secondary_order_high
    );
    eligible_inbound_count = eligible_inbound_count + 1u;
    if (secondary_better) {
      if (secondary_index < mechanical_params.particle_count) {
        tertiary_index = secondary_index;
        center_tertiary_cursor = center_secondary_cursor;
        tertiary_center_cursor = secondary_center_cursor;
        tertiary_pair = secondary_pair;
        tertiary_priority = secondary_priority;
        tertiary_face_alignment = secondary_face_alignment;
        tertiary_rank = secondary_rank;
        tertiary_order_low = secondary_order_low;
        tertiary_order_high = secondary_order_high;
      }
      secondary_index = candidate_index;
      center_secondary_cursor = cursor;
      secondary_center_cursor = candidate_cursor;
      secondary_pair = candidate_pair;
      secondary_priority = candidate_priority;
      secondary_face_alignment = candidate_face_alignment;
      secondary_rank = candidate_rank;
      secondary_order_low = candidate_low;
      secondary_order_high = candidate_high;
    } else if (mechanical_matching_inbound_candidate_better(
      candidate_priority,
      candidate_face_alignment,
      candidate_rank,
      candidate_low,
      candidate_high,
      tertiary_priority,
      tertiary_face_alignment,
      tertiary_rank,
      tertiary_order_low,
      tertiary_order_high
    )) {
      tertiary_index = candidate_index;
      center_tertiary_cursor = cursor;
      tertiary_center_cursor = candidate_cursor;
      tertiary_pair = candidate_pair;
      tertiary_priority = candidate_priority;
      tertiary_face_alignment = candidate_face_alignment;
      tertiary_rank = candidate_rank;
      tertiary_order_low = candidate_low;
      tertiary_order_high = candidate_high;
    }
  }
  // Several heavier peers may reserve the same lighter center, but only its
  // mutual primary can launch a block in this pass. Retain at most two inbound
  // supports with the same deterministic ordering as the matching sweep. The
  // four-body projection is exact only for the closed degree-three star; a
  // higher-degree center must stay on the proven three-body path because a
  // truncated projection can immediately reactivate an omitted contact.
  if (eligible_inbound_count == 0u) { return result; }
  result.block_found = 1u;
  result.secondary_index = secondary_index;
  result.center_secondary_cursor = center_secondary_cursor;
  result.secondary_center_cursor = secondary_center_cursor;
  result.member_count = 3u;
  let terminal_star_window = mechanical_matching_current_pass() + 16u
    >= ${solverBudget.cleanupPassBudget}u;
  if (eligible_inbound_count == 2u && terminal_star_window) {
    result.tertiary_index = tertiary_index;
    result.center_tertiary_cursor = center_tertiary_cursor;
    result.tertiary_center_cursor = tertiary_center_cursor;
    let four_block = mechanical_matching_four_block(
      result,
      primary_pair,
      secondary_pair,
      tertiary_pair
    );
    if (four_block.valid == 0u || four_block.applied != 0u) {
      return four_block;
    }
  }

  let center_primary_constraint =
    matching_constraints[center_primary_cursor];
  let center_secondary_constraint =
    matching_constraints[center_secondary_cursor];
  let primary_normal = mechanical_matching_center_oriented_vector(
    center_index,
    primary_index,
    mechanical_matching_constraint_normal(center_primary_constraint)
  );
  let secondary_normal = mechanical_matching_center_oriented_vector(
    center_index,
    secondary_index,
    mechanical_matching_constraint_normal(center_secondary_constraint)
  );
  let primary_response = mechanical_matching_center_oriented_vector(
    center_index,
    primary_index,
    center_primary_constraint.xyz
  );
  let secondary_response = mechanical_matching_center_oriented_vector(
    center_index,
    secondary_index,
    center_secondary_constraint.xyz
  );
  if (
    !mechanical_solver_finite3(primary_normal)
    || !mechanical_solver_finite3(secondary_normal)
    || !mechanical_solver_finite3(primary_response)
    || !mechanical_solver_finite3(secondary_response)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    length(primary_response - primary_normal) > 1.0e-5
    || length(secondary_response - secondary_normal) > 1.0e-5
    || dot(primary_response, primary_normal) <= 1.0e-6
    || dot(secondary_response, secondary_normal) <= 1.0e-6
  ) { return result; }

  let primary_position_tolerance =
    mechanical_matching_position_tolerance(mutual_low, mutual_high);
  let secondary_low = min(center_index, secondary_index);
  let secondary_high = max(center_index, secondary_index);
  let secondary_low_mass = input_state[secondary_low * 2u].w;
  let secondary_high_mass = input_state[secondary_high * 2u].w;
  let secondary_position_tolerance =
    mechanical_matching_position_tolerance(secondary_low, secondary_high);
  let primary_position_ratio =
    primary_pair.position_residual / primary_position_tolerance;
  let primary_position_update_ratio =
    length(primary_pair.barrier_dx)
      * (1.0 + low_pos_mass.w / high_pos_mass.w)
      / primary_position_tolerance;
  let secondary_position_ratio =
    secondary_pair.position_residual / secondary_position_tolerance;
  let secondary_position_update_ratio =
    length(secondary_pair.barrier_dx)
      * (1.0 + secondary_low_mass / secondary_high_mass)
      / secondary_position_tolerance;
  if (
    !mechanical_solver_finite(primary_position_ratio)
    || !mechanical_solver_finite(primary_position_update_ratio)
    || !mechanical_solver_finite(secondary_position_ratio)
    || !mechanical_solver_finite(secondary_position_update_ratio)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_position_ratio > 0.5
    || primary_position_update_ratio > 0.5
    || secondary_position_ratio > 0.5
    || secondary_position_update_ratio > 0.5
  ) { return result; }

  let center_velocity = input_state[center_index * 2u + 1u].xyz;
  let primary_velocity = input_state[primary_index * 2u + 1u].xyz;
  let secondary_pos_mass = input_state[secondary_index * 2u];
  let secondary_velocity = input_state[secondary_index * 2u + 1u].xyz;
  let primary_relative_velocity = dot(
    center_velocity - primary_velocity,
    primary_normal
  );
  let secondary_relative_velocity = dot(
    center_velocity - secondary_velocity,
    secondary_normal
  );
  if (
    !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite(primary_relative_velocity)
    || !mechanical_solver_finite(secondary_relative_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  // The mutual primary is the currently violated edge. The reserved secondary
  // was already processed in this sweep and is normally satisfied here; it
  // must still participate when the primary-only projection would reactivate
  // it. The dual active-set test below decides whether its multiplier is
  // positive.
  if (!(primary_relative_velocity < -1.0e-5)) { return result; }

  let center_inverse_mass = 1.0 / center_pos_mass.w;
  let primary_inverse_mass = 1.0 / primary_pos_mass.w;
  let secondary_inverse_mass = 1.0 / secondary_pos_mass.w;
  let effective_primary_mass =
    center_inverse_mass + primary_inverse_mass;
  let effective_secondary_mass =
    center_inverse_mass + secondary_inverse_mass;
  let effective_cross_mass =
    center_inverse_mass * dot(primary_normal, secondary_normal);
  let effective_determinant =
    effective_primary_mass * effective_secondary_mass
      - effective_cross_mass * effective_cross_mass;
  let determinant_conditioning =
    abs(effective_primary_mass * effective_secondary_mass)
      + abs(effective_cross_mass * effective_cross_mass);
  let determinant_tolerance = max(
    1.0e-12,
    64.0 * 1.1920929e-7 * max(determinant_conditioning, 1.0e-12)
  );
  if (
    !mechanical_solver_finite(center_inverse_mass)
    || !mechanical_solver_finite(primary_inverse_mass)
    || !mechanical_solver_finite(secondary_inverse_mass)
    || !mechanical_solver_finite(effective_primary_mass)
    || !mechanical_solver_finite(effective_secondary_mass)
    || !mechanical_solver_finite(effective_cross_mass)
    || !mechanical_solver_finite(effective_determinant)
    || effective_determinant <= determinant_tolerance
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_rhs = -primary_relative_velocity;
  let secondary_rhs = -secondary_relative_velocity;
  let primary_lambda = (
    primary_rhs * effective_secondary_mass
      - effective_cross_mass * secondary_rhs
  ) / effective_determinant;
  let secondary_lambda = (
    effective_primary_mass * secondary_rhs
      - effective_cross_mass * primary_rhs
  ) / effective_determinant;
  if (
    !mechanical_solver_finite(primary_lambda)
    || !mechanical_solver_finite(secondary_lambda)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  // A negative multiplier means the exact active set contains only one edge;
  // leave that case to the ordinary pair projection rather than applying an
  // attractive contact impulse.
  if (!(primary_lambda > 0.0) || !(secondary_lambda > 0.0)) {
    return result;
  }
  let center_impulse = primary_lambda * primary_normal
    + secondary_lambda * secondary_normal;
  let primary_impulse = -primary_lambda * primary_normal;
  let secondary_impulse = -secondary_lambda * secondary_normal;
  let block_masses_kg = vec3<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w
  );
  let x_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.x) > 0.5,
    abs(secondary_normal.x) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x
    )
  );
  let y_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.y) > 0.5,
    abs(secondary_normal.y) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y
    )
  );
  let z_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.z) > 0.5,
    abs(secondary_normal.z) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z
    )
  );
  let proposed_primary_velocity = vec3<f32>(
    x_contact_primal.x,
    y_contact_primal.x,
    z_contact_primal.x
  );
  let proposed_center_velocity = vec3<f32>(
    x_contact_primal.y,
    y_contact_primal.y,
    z_contact_primal.y
  );
  let proposed_secondary_velocity = vec3<f32>(
    x_contact_primal.z,
    y_contact_primal.z,
    z_contact_primal.z
  );
  let proposed_primary_residual = dot(
    proposed_center_velocity - proposed_primary_velocity,
    primary_normal
  );
  let proposed_secondary_residual = dot(
    proposed_center_velocity - proposed_secondary_velocity,
    secondary_normal
  );
  let block_residual_tolerance_m_per_s = 1.0e-5;
  if (
    !mechanical_solver_finite3(center_impulse)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(proposed_primary_velocity)
    || !mechanical_solver_finite3(proposed_center_velocity)
    || !mechanical_solver_finite3(proposed_secondary_velocity)
    || !mechanical_solver_finite(proposed_primary_residual)
    || !mechanical_solver_finite(proposed_secondary_residual)
    || abs(proposed_primary_residual)
      > block_residual_tolerance_m_per_s
    || abs(proposed_secondary_residual)
      > block_residual_tolerance_m_per_s
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_wall = mechanical_matching_project_wall_velocity(
    primary_index,
    primary_pos_mass.xyz,
    proposed_primary_velocity,
    primary_pos_mass.w
  );
  let center_wall = mechanical_matching_project_wall_velocity(
    center_index,
    center_pos_mass.xyz,
    proposed_center_velocity,
    center_pos_mass.w
  );
  let secondary_wall = mechanical_matching_project_wall_velocity(
    secondary_index,
    secondary_pos_mass.xyz,
    proposed_secondary_velocity,
    secondary_pos_mass.w
  );
  if (
    primary_wall.valid == 0u
    || center_wall.valid == 0u
    || secondary_wall.valid == 0u
  ) {
    result.failure_code = select(
      select(
        secondary_wall.failure_code,
        center_wall.failure_code,
        center_wall.valid == 0u
      ),
      primary_wall.failure_code,
      primary_wall.valid == 0u
    );
    result.valid = 0u;
    return result;
  }
  if (
    primary_wall.clipped != 0u
    || center_wall.clipped != 0u
    || secondary_wall.clipped != 0u
  ) {
    return mechanical_matching_three_block_box_wall_active_set(
      result,
      primary_normal,
      secondary_normal,
      primary_pos_mass,
      center_pos_mass,
      secondary_pos_mass,
      primary_velocity,
      center_velocity,
      secondary_velocity,
      proposed_primary_velocity,
      proposed_center_velocity,
      proposed_secondary_velocity,
      block_residual_tolerance_m_per_s
    );
  }
  let primary_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(primary_wall.velocity, primary_wall.velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(center_wall.velocity, center_wall.velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(secondary_wall.velocity, secondary_wall.velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let realized_primary_impulse =
    primary_pos_mass.w * (primary_wall.velocity - primary_velocity);
  let realized_center_impulse =
    center_pos_mass.w * (center_wall.velocity - center_velocity);
  let realized_secondary_impulse =
    secondary_pos_mass.w * (secondary_wall.velocity - secondary_velocity);
  let aggregate_kinetic_delta_j =
    primary_kinetic_delta_j
      + center_kinetic_delta_j
      + secondary_kinetic_delta_j;
  let aggregate_momentum_residual =
    realized_primary_impulse
      + realized_center_impulse
      + realized_secondary_impulse;
  let momentum_conditioning =
    length(realized_primary_impulse)
      + length(realized_center_impulse)
      + length(realized_secondary_impulse);
  let momentum_tolerance = max(
    1.0e-6,
    256.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_pos_mass.w * (
      dot(primary_velocity, primary_velocity)
        + dot(primary_wall.velocity, primary_wall.velocity)
    )
      + center_pos_mass.w * (
      dot(center_velocity, center_velocity)
        + dot(center_wall.velocity, center_wall.velocity)
    )
      + secondary_pos_mass.w * (
      dot(secondary_velocity, secondary_velocity)
        + dot(secondary_wall.velocity, secondary_wall.velocity)
    )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite3(primary_wall.velocity)
    || !mechanical_solver_finite3(center_wall.velocity)
    || !mechanical_solver_finite3(secondary_wall.velocity)
    || !mechanical_solver_finite(primary_kinetic_delta_j)
    || !mechanical_solver_finite(center_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_kinetic_delta_j)
    || !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || !mechanical_solver_finite3(realized_primary_impulse)
    || !mechanical_solver_finite3(realized_center_impulse)
    || !mechanical_solver_finite3(realized_secondary_impulse)
    || !mechanical_solver_finite3(aggregate_momentum_residual)
    || length(aggregate_momentum_residual) > momentum_tolerance
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      mechanical_solver_finite(aggregate_kinetic_delta_j)
        && aggregate_kinetic_delta_j > kinetic_tolerance_j
    );
    result.valid = 0u;
    return result;
  }
  result.center_velocity = center_wall.velocity;
  result.primary_velocity = primary_wall.velocity;
  result.secondary_velocity = secondary_wall.velocity;
  result.center_kinetic_delta_j = center_kinetic_delta_j;
  result.primary_kinetic_delta_j = primary_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = realized_primary_impulse;
  result.center_primary_impulse = -realized_primary_impulse;
  result.secondary_impulse = realized_secondary_impulse;
  result.center_secondary_impulse = -realized_secondary_impulse;
  result.applied = 1u;
  return result;
}

@compute @workgroup_size(64)
fn initialize_matching_cleanup_constraints(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  let owner_word_count =
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
      + mechanical_params.particle_count;
  if (self_index == 0u) {
    if (arrayLength(&matching_cleanup_dispatch) < owner_word_count) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    } else {
      atomicStore(
        &matching_cleanup_dispatch[0u],
        select(
          0u,
          (mechanical_params.particle_count + 63u) / 64u,
          mechanical_solver_full_path_enabled()
        )
      );
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
    }
  }
  if (self_index >= mechanical_params.particle_count) { return; }
  if (arrayLength(&matching_cleanup_dispatch) < owner_word_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (
    !mechanical_matching_jacobi_ready()
    || begin > end
    || end > total
    || total > arrayLength(&matching_constraints)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = mechanical_solver_peer_index(csr_peers[cursor]);
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let low_class = mechanical_solver_phase_class(low_index);
    let high_class = mechanical_solver_phase_class(high_index);
    let eligible_unilateral_pair =
      low_class != 0u
      && high_class != 0u
      && !mechanical_solver_same_phase_lineage(low_index, high_index)
      && !mechanical_solver_same_body_solid_pair(low_index, high_index)
      && mechanical_solver_unilateral_pair(low_index, high_index);
    var constraint = vec4<f32>(0.0);
    let low_pos_mass = input_state[low_index * 2u];
    let high_pos_mass = input_state[high_index * 2u];
    let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
    let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
    if (
      eligible_unilateral_pair
      && low_pos_mass.w > 0.0
      && high_pos_mass.w > 0.0
      && low_volume > 0.0
      && high_volume > 0.0
    ) {
      let current_delta = low_pos_mass.xyz - high_pos_mass.xyz;
      let epoch_delta = mechanical_solver_epoch_position(low_index)
        - mechanical_solver_epoch_position(high_index);
      let finite_volume_contact = mechanical_solver_finite_volume_contact(
        low_index,
        high_index,
        current_delta,
        epoch_delta,
        mechanical_solver_cbrt(low_volume),
        mechanical_solver_cbrt(high_volume)
      );
      let separating_normal = mechanical_matching_separating_normal(
        low_index,
        high_index,
        current_delta
      );
      let constraint_normal = select(
        separating_normal,
        finite_volume_contact.normal,
        finite_volume_contact.admitted != 0u
      );
      let response_normal = select(
        constraint_normal,
        finite_volume_contact.response_normal,
        finite_volume_contact.admitted != 0u
      );
      let response_projection = dot(response_normal, constraint_normal);
      if (
        !mechanical_solver_finite3(constraint_normal)
        || !mechanical_solver_finite3(response_normal)
        || abs(length(constraint_normal) - 1.0) > 1.0e-3
        || abs(length(response_normal) - 1.0) > 1.0e-3
        || !mechanical_solver_finite(response_projection)
        || response_projection <= 1.0e-6
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      // A fixed supporting halfspace makes the colored cleanup a sequence of
      // projections onto immutable convex constraints. xyz preserves the face
      // response and abs(w) exactly encodes its axis/sign. Positive codes were
      // admitted at initialization. Negative codes remain dormant until
      // cleanup motion reaches that same finite-volume face. Evaluation also
      // requires every positive row to retain finite tangential face support,
      // preventing a frozen face from becoming an infinite lateral barrier.
      let constraint_code =
        mechanical_matching_constraint_code(constraint_normal);
      constraint = vec4<f32>(
        response_normal,
        select(
          -constraint_code,
          constraint_code,
          finite_volume_contact.admitted != 0u
        )
      );
    }
    matching_constraints[cursor] = constraint;
    // Jacobi owns this bit before cleanup, while matching owns it afterward.
    // Strip every row once here so a dormant row that joins the monotone
    // frontier later cannot inherit a stale Jacobi "already processed" mark.
    csr_peers[cursor] = peer_index;
    if (constraint.w != 0.0) {
      let frozen_pair = mechanical_matching_constraint_pair(
        low_index,
        high_index,
        cursor
      );
      if (frozen_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (
        frozen_pair.active_pair != 0u
        && frozen_pair.unilateral != 0u
      ) {
        csr_peers[cursor] =
          peer_index | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
        let contact_flags = MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT;
        atomicOr(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ],
          contact_flags
        );
        atomicOr(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
          ],
          contact_flags
        );
      }
    }
  }
  let input_pos_mass = input_state[self_index * 2u];
  let input_vel_u = input_state[self_index * 2u + 1u];
  let rest_volume = max(
    source_mechanics[self_index * 8u + 4u].w,
    0.0
  );
  let wall_projection_bound_m =
    mechanical_solver_wall_projection_bound(self_index);
  let wall_velocity = mechanical_matching_project_wall_velocity(
    self_index,
    input_pos_mass.xyz,
    input_vel_u.xyz,
    input_pos_mass.w
  );
  let zero_volume_wall_position_active = rest_volume <= 0.0
    && (
      any(input_pos_mass.xyz < vec3<f32>(0.0))
      || any(input_pos_mass.xyz > mechanical_params.box_dims_m)
    );
  let wall_active = (rest_volume > 0.0 && wall_projection_bound_m > 0.0)
    || zero_volume_wall_position_active
    || wall_velocity.clipped != 0u
    || (input_pos_mass.w > 0.0 && wall_velocity.valid == 0u)
    || !mechanical_solver_finite3(input_pos_mass.xyz)
    || !mechanical_solver_finite3(input_vel_u.xyz)
    || !mechanical_solver_finite(wall_projection_bound_m);
  let invalid_index = 0xffffffffu;
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(invalid_index),
    0.0,
    bitcast<f32>(invalid_index),
    bitcast<f32>(invalid_index)
  );
  if (wall_active) {
    atomicOr(
      &matching_cleanup_dispatch[
        MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
      ],
      MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
    );
  }
}

fn mechanical_matching_preflight(pass_index: u32) -> bool {
  if (
    !mechanical_matching_cleanup_header_valid()
    || !mechanical_matching_jacobi_ready()
    || arrayLength(&matching_constraints)
      < mechanical_params.directed_pair_capacity
    || pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return false;
  }
  if (
    pass_index > 0u
    && atomicLoad(
      &traversal_evidence[
        mechanical_matching_wall_count_word(pass_index - 1u)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return false;
  }
  return true;
}

struct MechanicalMatchingSelectionScan {
  best_peer: u32,
  best_rank: u32,
  best_cursor: u32,
  best_low_high: u32,
  best_priority: f32,
  best_face_alignment: f32,
  reserved_peer: u32,
  reserved_rank: u32,
  reserved_cursor: u32,
  reserved_low_high: u32,
  reserved_priority: f32,
  reserved_face_alignment: f32,
  row_max_position_ratio: f32,
  row_max_velocity_residual_m_per_s: f32,
};

fn mechanical_matching_selection_empty_scan() ->
  MechanicalMatchingSelectionScan {
  var scan: MechanicalMatchingSelectionScan;
  scan.best_peer = 0xffffffffu;
  scan.best_rank = 0xffffffffu;
  scan.best_cursor = 0xffffffffu;
  scan.best_low_high = 0xffffffffu;
  scan.best_priority = 0.0;
  scan.best_face_alignment = 0.0;
  scan.reserved_peer = 0xffffffffu;
  scan.reserved_rank = 0xffffffffu;
  scan.reserved_cursor = 0xffffffffu;
  scan.reserved_low_high = 0xffffffffu;
  scan.reserved_priority = -1.0;
  scan.reserved_face_alignment = 0.0;
  scan.row_max_position_ratio = 0.0;
  // A negative sentinel marks a failed scan: real row maxima are always
  // >= 0, and the epilogue is skipped for failed members exactly as the
  // serial path's early return skipped it.
  scan.row_max_velocity_residual_m_per_s = 0.0;
  return scan;
}

// Jacobi-converged pass-0 shortcut, one member's ledger sentinel and
// evidence contribution. Extracted verbatim from the serial selection.
fn mechanical_matching_selection_converged_for_index(
  self_index: u32,
  pass_index: u32
) {
  let final_iteration = mechanical_params.solver_iteration_count - 1u;
  let position_ratio = atomicLoad(
    &graph_control[
      mechanical_pre_solve_position_violation_ratio_word(final_iteration)
    ]
  );
  let velocity_residual = atomicLoad(
    &graph_control[
      mechanical_pre_solve_velocity_residual_word(final_iteration)
    ]
  );
  var invalid_index = 0xffffffffu;
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(invalid_index),
    0.0,
    bitcast<f32>(invalid_index),
    bitcast<f32>(invalid_index)
  );
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_position_ratio_word(pass_index)
    ],
    position_ratio
  );
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_velocity_residual_word(pass_index)
    ],
    velocity_residual
  );
  atomicAdd(
    &traversal_evidence[
      mechanical_matching_selection_count_word(pass_index)
    ],
    1u
  );
}

// The candidate row scan over every cursor_stride-th cursor from
// cursor_offset. Byte-for-byte the serial selection's scan; the serial
// path calls it with (0, 1). The winner over any cursor partition is
// scan-order independent because the selection predicate is a strict
// total order (priority desc, face-alignment desc, rank asc, then the
// unique (low, high) pair), so merging per-sublane partial results
// reproduces the serial winner exactly.
fn mechanical_matching_selection_scan_range(
  self_index: u32,
  pass_index: u32,
  full_selection: bool,
  begin_new_sweep: bool,
  cursor_offset: u32,
  cursor_stride: u32
) -> MechanicalMatchingSelectionScan {
  var scan_failed = false;
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    var failed = mechanical_matching_selection_empty_scan();
    failed.row_max_velocity_residual_m_per_s = -1.0;
    return failed;
  }
  if (begin_new_sweep) {
    // The CSR high bit is solver-private and final verification always strips
    // it before publication. Reuse it as one fixed-order sweep marker.
    for (
      var cursor = begin + cursor_offset;
      cursor < end;
      cursor = cursor + cursor_stride
    ) {
      csr_peers[cursor] = csr_peers[cursor]
        & (MECHANICAL_SOLVER_EDGE_PEER_MASK
          | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT);
    }
  }
  var best_peer = 0xffffffffu;
  var best_low = 0xffffffffu;
  var best_high = 0xffffffffu;
  var best_rank = 0xffffffffu;
  var best_cursor = 0xffffffffu;
  var best_priority = 0.0;
  var best_face_alignment = 0.0;
  var reserved_peer = 0xffffffffu;
  var reserved_low = 0xffffffffu;
  var reserved_high = 0xffffffffu;
  var reserved_rank = 0xffffffffu;
  var reserved_cursor = 0xffffffffu;
  var reserved_priority = -1.0;
  var reserved_face_alignment = 0.0;
  var row_max_position_ratio = 0.0;
  var row_max_velocity_residual_m_per_s = 0.0;
  for (
    var cursor = begin + cursor_offset;
    cursor < end;
    cursor = cursor + cursor_stride
  ) {
    let encoded_peer = csr_peers[cursor];
    if (
      !full_selection
      && !mechanical_matching_edge_ever_active(encoded_peer)
    ) { continue; }
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      scan_failed = true;
      break;
    }
    if (pair.active_pair == 0u || pair.unilateral == 0u) { continue; }
    if (!mechanical_matching_edge_ever_active(encoded_peer)) {
      csr_peers[cursor] =
        encoded_peer | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
    }
    let position_ratio = pair.position_residual
      / mechanical_matching_position_tolerance(low_index, high_index);
    let low_mass = input_state[low_index * 2u].w;
    let high_mass = input_state[high_index * 2u].w;
    let position_update_ratio = length(pair.barrier_dx)
      * (1.0 + low_mass / max(high_mass, 1.0e-30))
      / mechanical_matching_position_tolerance(low_index, high_index);
    let velocity_ratio = pair.velocity_residual / ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
    let priority = max(
      max(position_ratio, position_update_ratio),
      velocity_ratio
    );
    row_max_position_ratio = max(row_max_position_ratio, position_ratio);
    row_max_velocity_residual_m_per_s = max(
      row_max_velocity_residual_m_per_s,
      pair.velocity_residual
    );
    let edge_rank = mechanical_matching_edge_rank(low_index, high_index);
    let constraint_normal = mechanical_matching_constraint_normal(
      matching_constraints[cursor]
    );
    let face_alignment = max(
      abs(constraint_normal.x),
      max(abs(constraint_normal.y), abs(constraint_normal.z))
    );
    let self_mass = select(high_mass, low_mass, self_index == low_index);
    let peer_mass = select(low_mass, high_mass, self_index == low_index);
    let reserved_better = priority > reserved_priority
      || (
        priority == reserved_priority
        && (
          face_alignment > reserved_face_alignment
          || (
            face_alignment == reserved_face_alignment
            && (
              edge_rank < reserved_rank
              || (
                edge_rank == reserved_rank
                && (
                  low_index < reserved_low
                  || (
                    low_index == reserved_low
                    && high_index < reserved_high
                  )
                )
              )
            )
          )
        )
      );
    // A processed edge stays part of the frozen contact intersection even
    // while its residual is satisfied. Retain one deterministic heavy-to-light
    // support cursor independently of the ordinary unprocessed selection. The
    // next overlapping mutual pair can then project all three vertices even
    // when this heavy endpoint also has an unrelated non-reciprocal edge. The
    // strict orientation and single cursor reserve the vertex for at most one
    // block without atomics.
    if (
      mechanical_solver_edge_inactive(encoded_peer)
      && self_mass > peer_mass
      && reserved_better
    ) {
      reserved_peer = peer_index;
      reserved_low = low_index;
      reserved_high = high_index;
      reserved_rank = edge_rank;
      reserved_cursor = cursor;
      reserved_priority = priority;
      reserved_face_alignment = face_alignment;
    }
    let better = priority > best_priority
      || (
        priority == best_priority
        && (
          face_alignment > best_face_alignment
          || (
            face_alignment == best_face_alignment
            && (
              edge_rank < best_rank
              || (
                edge_rank == best_rank
                && (
                  low_index < best_low
                  || (low_index == best_low && high_index < best_high)
                )
              )
            )
          )
        )
      );
    if (
      priority > 1.0
      && !mechanical_solver_edge_inactive(encoded_peer)
      && better
    ) {
      best_peer = peer_index;
      best_low = low_index;
      best_high = high_index;
      best_rank = edge_rank;
      best_cursor = cursor;
      best_priority = priority;
      best_face_alignment = face_alignment;
    }
  }
  var scan = mechanical_matching_selection_empty_scan();
  if (scan_failed) {
    scan.row_max_velocity_residual_m_per_s = -1.0;
    return scan;
  }
  scan.best_peer = best_peer;
  scan.best_rank = best_rank;
  scan.best_cursor = best_cursor;
  scan.best_low_high = (best_low << 16u) | (best_high & 0xffffu);
  scan.best_priority = best_priority;
  scan.best_face_alignment = best_face_alignment;
  scan.reserved_peer = reserved_peer;
  scan.reserved_rank = reserved_rank;
  scan.reserved_cursor = reserved_cursor;
  scan.reserved_low_high = (reserved_low << 16u) | (reserved_high & 0xffffu);
  scan.reserved_priority = reserved_priority;
  scan.reserved_face_alignment = reserved_face_alignment;
  scan.row_max_position_ratio = row_max_position_ratio;
  scan.row_max_velocity_residual_m_per_s = row_max_velocity_residual_m_per_s;
  return scan;
}

// Fold two partial scans. The packed (low << 16 | high) word compares
// exactly as the lexicographic (low, high) tie-break because particle
// indexes fit sixteen bits. NaN priorities compare false everywhere and
// therefore never displace a candidate, matching the serial scan.
fn mechanical_matching_selection_merge(
  a: MechanicalMatchingSelectionScan,
  b: MechanicalMatchingSelectionScan
) -> MechanicalMatchingSelectionScan {
  var out = a;
  if (b.best_peer != 0xffffffffu) {
    let take = out.best_peer == 0xffffffffu
      || b.best_priority > out.best_priority
      || (
        b.best_priority == out.best_priority
        && (
          b.best_face_alignment > out.best_face_alignment
          || (
            b.best_face_alignment == out.best_face_alignment
            && (
              b.best_rank < out.best_rank
              || (
                b.best_rank == out.best_rank
                && b.best_low_high < out.best_low_high
              )
            )
          )
        )
      );
    if (take) {
      out.best_peer = b.best_peer;
      out.best_rank = b.best_rank;
      out.best_cursor = b.best_cursor;
      out.best_low_high = b.best_low_high;
      out.best_priority = b.best_priority;
      out.best_face_alignment = b.best_face_alignment;
    }
  }
  if (b.reserved_peer != 0xffffffffu) {
    let take = out.reserved_peer == 0xffffffffu
      || b.reserved_priority > out.reserved_priority
      || (
        b.reserved_priority == out.reserved_priority
        && (
          b.reserved_face_alignment > out.reserved_face_alignment
          || (
            b.reserved_face_alignment == out.reserved_face_alignment
            && (
              b.reserved_rank < out.reserved_rank
              || (
                b.reserved_rank == out.reserved_rank
                && b.reserved_low_high < out.reserved_low_high
              )
            )
          )
        )
      );
    if (take) {
      out.reserved_peer = b.reserved_peer;
      out.reserved_rank = b.reserved_rank;
      out.reserved_cursor = b.reserved_cursor;
      out.reserved_low_high = b.reserved_low_high;
      out.reserved_priority = b.reserved_priority;
      out.reserved_face_alignment = b.reserved_face_alignment;
    }
  }
  out.row_max_position_ratio = max(
    out.row_max_position_ratio,
    b.row_max_position_ratio
  );
  out.row_max_velocity_residual_m_per_s = min(
    max(
      out.row_max_velocity_residual_m_per_s,
      b.row_max_velocity_residual_m_per_s
    ),
    select(
      3.4e38,
      -1.0,
      out.row_max_velocity_residual_m_per_s < 0.0
        || b.row_max_velocity_residual_m_per_s < 0.0
    )
  );
  return out;
}

// The per-member selection epilogue: reserved fallback, ledger
// publication, transient full-selection clear, and the pass evidence
// contribution. Extracted verbatim from the serial selection.
fn mechanical_matching_selection_epilogue(
  self_index: u32,
  pass_index: u32,
  full_selection: bool,
  // The per-member selection-completeness contribution must be counted
  // exactly once per logical pass; inner solver rounds after the first
  // republish ledger rows with counting disabled. The row-maximum
  // contributions stay unconditional (re-maxing is idempotent).
  count_evidence: bool,
  scan: MechanicalMatchingSelectionScan
) {
  var best_peer = scan.best_peer;
  var best_cursor = scan.best_cursor;
  var best_priority = scan.best_priority;
  let reserved_peer = scan.reserved_peer;
  let reserved_cursor = scan.reserved_cursor;
  let reserved_priority = scan.reserved_priority;
  let row_max_position_ratio = scan.row_max_position_ratio;
  let row_max_velocity_residual_m_per_s =
    scan.row_max_velocity_residual_m_per_s;
  if (
    best_peer >= mechanical_params.particle_count
    && reserved_peer < mechanical_params.particle_count
  ) {
    best_peer = reserved_peer;
    best_cursor = reserved_cursor;
    best_priority = reserved_priority;
  }
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(best_peer),
    best_priority,
    bitcast<f32>(best_cursor),
    bitcast<f32>(reserved_cursor)
  );
  if (full_selection) {
    atomicAnd(
      &matching_cleanup_dispatch[
        MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
      ],
      ~MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
    );
  }
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_position_ratio_word(pass_index)
    ],
    bitcast<u32>(row_max_position_ratio)
  );
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_velocity_residual_word(pass_index)
    ],
    bitcast<u32>(row_max_velocity_residual_m_per_s)
  );
  if (count_evidence) {
    atomicAdd(
      &traversal_evidence[
        mechanical_matching_selection_count_word(pass_index)
      ],
      1u
    );
  }
}

fn select_matching_cleanup_edge_for_index(
  self_index: u32,
  force_full_selection: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (!mechanical_matching_preflight(pass_index)) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let begin_new_sweep = pass_index == 0u
    || mechanical_matching_prior_applied_pair_count(pass_index) == 0u;
  if (
    pass_index == 0u
    && mechanical_matching_jacobi_residual_converged()
  ) {
    mechanical_matching_selection_converged_for_index(
      self_index,
      pass_index
    );
    return;
  }
  let owner_flags = atomicLoad(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
    ]
  );
  // The production owner partitions dormant discovery from known-active
  // selection. The standalone diagnostic/legacy topology has no expansion
  // phase, so its wrapper forces the historical complete row scan.
  let full_selection = force_full_selection
    || (owner_flags & MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT) != 0u;
  let scan = mechanical_matching_selection_scan_range(
    self_index,
    pass_index,
    full_selection,
    begin_new_sweep,
    0u,
    1u
  );
  if (scan.row_max_velocity_residual_m_per_s < 0.0) {
    return;
  }
  mechanical_matching_selection_epilogue(
    self_index,
    pass_index,
    full_selection,
    true,
    scan
  );
}

@compute @workgroup_size(64)
fn select_matching_cleanup_edge(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  select_matching_cleanup_edge_for_index(global_id.x, true);
}

fn copy_matching_cleanup_state_for_index(self_index: u32) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) {
    // The host keeps a deterministic ping-pong schedule. Once the GPU has
    // certified convergence, propagate only the terminal state so that the
    // fixed encoded parity remains truthful without repeating pair scans.
    output_state[self_index * 2u] = input_state[self_index * 2u];
    output_state[self_index * 2u + 1u] =
      input_state[self_index * 2u + 1u];
    return;
  }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_selection_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  output_state[self_index * 2u] = input_state[self_index * 2u];
  output_state[self_index * 2u + 1u] = input_state[self_index * 2u + 1u];
  atomicAdd(
    &traversal_evidence[mechanical_matching_copy_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn copy_matching_cleanup_state(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  copy_matching_cleanup_state_for_index(global_id.x);
}

fn apply_matching_cleanup_edge_for_index(
  self_index: u32,
  // The per-member apply-completeness contribution must be counted exactly
  // once per logical pass; inner solver rounds after the first re-run this
  // function with counting disabled. Applied-pair evidence always
  // accumulates (the sweep delimiter reads the pass total).
  count_completeness: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_copy_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let selection = energy_ledger[mechanical_energy_base(self_index)];
  let peer_index = bitcast<u32>(selection.x);
  if (peer_index < mechanical_params.particle_count && self_index < peer_index) {
    let peer_selection = energy_ledger[mechanical_energy_base(peer_index)];
    if (bitcast<u32>(peer_selection.x) == self_index) {
      let low_index = self_index;
      let high_index = peer_index;
      let low_cursor = bitcast<u32>(selection.z);
      let high_cursor = bitcast<u32>(peer_selection.z);
      let low_begin = source_offsets[low_index];
      let low_end = source_offsets[low_index + 1u];
      let high_begin = source_offsets[high_index];
      let high_end = source_offsets[high_index + 1u];
      if (
        low_cursor < low_begin
        || low_cursor >= low_end
        || high_cursor < high_begin
        || high_cursor >= high_end
        || mechanical_solver_peer_index(csr_peers[low_cursor]) != high_index
        || mechanical_solver_peer_index(csr_peers[high_cursor]) != low_index
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
        );
        return;
      }
      let pair = mechanical_matching_constraint_pair(
        low_index,
        high_index,
        low_cursor
      );
      let low_constraint = matching_constraints[low_cursor];
      let high_constraint = matching_constraints[high_cursor];
      if (
        pair.valid == 0u
        || pair.active_pair == 0u
        || pair.unilateral == 0u
        || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
        || !mechanical_matching_constraint_code_valid(low_constraint)
        || !mechanical_matching_constraint_code_valid(high_constraint)
        || low_constraint.w != high_constraint.w
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      let low_vel_u = input_state[low_index * 2u + 1u];
      let high_vel_u = input_state[high_index * 2u + 1u];
      if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let published_total = atomicLoad(&graph_control[12u]);
      let terminal_path_window = pass_index + 16u
        >= ${solverBudget.cleanupPassBudget}u;
      var three_block = mechanical_matching_zero_three_block();
      if (terminal_path_window) {
        three_block = mechanical_matching_four_path_block(
          low_index,
          high_index,
          published_total
        );
      }
      if (three_block.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            three_block.failure_code,
            three_block.failure_code != 0u
          )
        );
        return;
      }
      if (
        three_block.applied != 0u
        && three_block.topology == 1u
        && three_block.path_owner == 0u
      ) {
        if (count_completeness) {
          atomicAdd(
            &traversal_evidence[
              mechanical_matching_apply_count_word(pass_index)
            ],
            1u
          );
        }
        return;
      }
      if (three_block.applied == 0u) {
        three_block = mechanical_matching_three_block(
          low_index,
          high_index,
          low_cursor,
          high_cursor,
          published_total
        );
      }
      if (three_block.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            three_block.failure_code,
            three_block.failure_code != 0u
          )
        );
        return;
      }
      if (
        three_block.applied != 0u
        && three_block.member_count == 4u
      ) {
        let center_index = three_block.center_index;
        let primary_index = three_block.primary_index;
        let secondary_index = three_block.secondary_index;
        let tertiary_index = three_block.tertiary_index;
        let center_pos_mass = input_state[center_index * 2u];
        let primary_pos_mass = input_state[primary_index * 2u];
        let secondary_pos_mass = input_state[secondary_index * 2u];
        let tertiary_pos_mass = input_state[tertiary_index * 2u];
        let aggregate_mass = center_pos_mass.w
          + primary_pos_mass.w
          + secondary_pos_mass.w
          + tertiary_pos_mass.w;
        let center_cumulative =
          energy_ledger[mechanical_energy_base(center_index) + 1u];
        let primary_cumulative =
          energy_ledger[mechanical_energy_base(primary_index) + 1u];
        let secondary_cumulative =
          energy_ledger[mechanical_energy_base(secondary_index) + 1u];
        let tertiary_cumulative =
          energy_ledger[mechanical_energy_base(tertiary_index) + 1u];
        let center_next_pair_heat_j = center_cumulative.y
          + three_block.pair_heat_j * center_pos_mass.w / aggregate_mass;
        let primary_next_pair_heat_j = primary_cumulative.y
          + three_block.pair_heat_j * primary_pos_mass.w / aggregate_mass;
        let secondary_next_pair_heat_j = secondary_cumulative.y
          + three_block.pair_heat_j * secondary_pos_mass.w / aggregate_mass;
        let tertiary_next_pair_heat_j = tertiary_cumulative.y
          + three_block.pair_heat_j * tertiary_pos_mass.w / aggregate_mass;
        let center_next_wall_heat_j = center_cumulative.z
          + max(0.0, -three_block.center_wall_kinetic_delta_j);
        let primary_next_wall_heat_j = primary_cumulative.z
          + max(0.0, -three_block.primary_wall_kinetic_delta_j);
        let secondary_next_wall_heat_j = secondary_cumulative.z
          + max(0.0, -three_block.secondary_wall_kinetic_delta_j);
        let tertiary_next_wall_heat_j = tertiary_cumulative.z
          + max(0.0, -three_block.tertiary_wall_kinetic_delta_j);
        let center_next_u = center_cumulative.w
          + (center_next_pair_heat_j + center_next_wall_heat_j)
            / center_pos_mass.w;
        let primary_next_u = primary_cumulative.w
          + (primary_next_pair_heat_j + primary_next_wall_heat_j)
            / primary_pos_mass.w;
        let secondary_next_u = secondary_cumulative.w
          + (secondary_next_pair_heat_j + secondary_next_wall_heat_j)
            / secondary_pos_mass.w;
        let tertiary_next_u = tertiary_cumulative.w
          + (tertiary_next_pair_heat_j + tertiary_next_wall_heat_j)
            / tertiary_pos_mass.w;
        if (
          !(aggregate_mass > 0.0)
          || !mechanical_solver_finite(center_next_pair_heat_j)
          || !mechanical_solver_finite(primary_next_pair_heat_j)
          || !mechanical_solver_finite(secondary_next_pair_heat_j)
          || !mechanical_solver_finite(tertiary_next_pair_heat_j)
          || !mechanical_solver_finite(center_next_wall_heat_j)
          || !mechanical_solver_finite(primary_next_wall_heat_j)
          || !mechanical_solver_finite(secondary_next_wall_heat_j)
          || !mechanical_solver_finite(tertiary_next_wall_heat_j)
          || !mechanical_solver_finite(center_next_u)
          || !mechanical_solver_finite(primary_next_u)
          || !mechanical_solver_finite(secondary_next_u)
          || !mechanical_solver_finite(tertiary_next_u)
          || center_next_u < center_cumulative.w
          || primary_next_u < primary_cumulative.w
          || secondary_next_u < secondary_cumulative.w
          || tertiary_next_u < tertiary_cumulative.w
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .NEGATIVE_INTERNAL_ENERGY}u
          );
          return;
        }
        output_state[center_index * 2u] = center_pos_mass;
        output_state[primary_index * 2u] = primary_pos_mass;
        output_state[secondary_index * 2u] = secondary_pos_mass;
        output_state[tertiary_index * 2u] = tertiary_pos_mass;
        output_state[center_index * 2u + 1u] =
          vec4<f32>(three_block.center_velocity, center_next_u);
        output_state[primary_index * 2u + 1u] =
          vec4<f32>(three_block.primary_velocity, primary_next_u);
        output_state[secondary_index * 2u + 1u] =
          vec4<f32>(three_block.secondary_velocity, secondary_next_u);
        output_state[tertiary_index * 2u + 1u] =
          vec4<f32>(three_block.tertiary_velocity, tertiary_next_u);
        mechanical_matching_owner_record_mover(center_index);
        mechanical_matching_owner_record_mover(primary_index);
        mechanical_matching_owner_record_mover(secondary_index);
        mechanical_matching_owner_record_mover(tertiary_index);
        energy_ledger[mechanical_energy_base(center_index) + 1u] =
          vec4<f32>(
            center_cumulative.x + three_block.center_kinetic_delta_j,
            center_next_pair_heat_j,
            center_next_wall_heat_j,
            center_cumulative.w
          );
        energy_ledger[mechanical_energy_base(primary_index) + 1u] =
          vec4<f32>(
            primary_cumulative.x + three_block.primary_kinetic_delta_j,
            primary_next_pair_heat_j,
            primary_next_wall_heat_j,
            primary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(secondary_index) + 1u] =
          vec4<f32>(
            secondary_cumulative.x
              + three_block.secondary_kinetic_delta_j,
            secondary_next_pair_heat_j,
            secondary_next_wall_heat_j,
            secondary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(tertiary_index) + 1u] =
          vec4<f32>(
            tertiary_cumulative.x
              + three_block.tertiary_kinetic_delta_j,
            tertiary_next_pair_heat_j,
            tertiary_next_wall_heat_j,
            tertiary_cumulative.w
          );
        csr_peers[three_block.center_primary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_primary_cursor]
          );
        csr_peers[three_block.primary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.primary_center_cursor]
          );
        csr_peers[three_block.center_secondary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_secondary_cursor]
          );
        csr_peers[three_block.secondary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.secondary_center_cursor]
          );
        csr_peers[three_block.center_tertiary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_tertiary_cursor]
          );
        csr_peers[three_block.tertiary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.tertiary_center_cursor]
          );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(pass_index)
          ],
          3u
        );
        if (count_completeness) {
          atomicAdd(
            &traversal_evidence[
              mechanical_matching_apply_count_word(pass_index)
            ],
            1u
          );
        }
        return;
      }
      if (three_block.applied != 0u) {
        let center_index = three_block.center_index;
        let primary_index = three_block.primary_index;
        let secondary_index = three_block.secondary_index;
        let center_pos_mass = input_state[center_index * 2u];
        let primary_pos_mass = input_state[primary_index * 2u];
        let secondary_pos_mass = input_state[secondary_index * 2u];
        let aggregate_mass =
          center_pos_mass.w + primary_pos_mass.w + secondary_pos_mass.w;
        let center_cumulative =
          energy_ledger[mechanical_energy_base(center_index) + 1u];
        let primary_cumulative =
          energy_ledger[mechanical_energy_base(primary_index) + 1u];
        let secondary_cumulative =
          energy_ledger[mechanical_energy_base(secondary_index) + 1u];
        let center_next_pair_heat_j =
          center_cumulative.y
            + three_block.pair_heat_j * center_pos_mass.w / aggregate_mass;
        let primary_next_pair_heat_j =
          primary_cumulative.y
            + three_block.pair_heat_j * primary_pos_mass.w / aggregate_mass;
        let secondary_next_pair_heat_j =
          secondary_cumulative.y
            + three_block.pair_heat_j * secondary_pos_mass.w / aggregate_mass;
        let center_next_wall_heat_j =
          center_cumulative.z
            + max(0.0, -three_block.center_wall_kinetic_delta_j);
        let primary_next_wall_heat_j =
          primary_cumulative.z
            + max(0.0, -three_block.primary_wall_kinetic_delta_j);
        let secondary_next_wall_heat_j =
          secondary_cumulative.z
            + max(0.0, -three_block.secondary_wall_kinetic_delta_j);
        let center_next_u = center_cumulative.w
          + (center_next_pair_heat_j + center_next_wall_heat_j)
            / center_pos_mass.w;
        let primary_next_u = primary_cumulative.w
          + (primary_next_pair_heat_j + primary_next_wall_heat_j)
            / primary_pos_mass.w;
        let secondary_next_u = secondary_cumulative.w
          + (secondary_next_pair_heat_j + secondary_next_wall_heat_j)
            / secondary_pos_mass.w;
        if (
          !(aggregate_mass > 0.0)
          || !mechanical_solver_finite(center_next_pair_heat_j)
          || !mechanical_solver_finite(primary_next_pair_heat_j)
          || !mechanical_solver_finite(secondary_next_pair_heat_j)
          || !mechanical_solver_finite(center_next_wall_heat_j)
          || !mechanical_solver_finite(primary_next_wall_heat_j)
          || !mechanical_solver_finite(secondary_next_wall_heat_j)
          || !mechanical_solver_finite(center_next_u)
          || !mechanical_solver_finite(primary_next_u)
          || !mechanical_solver_finite(secondary_next_u)
          || center_next_u < center_cumulative.w
          || primary_next_u < primary_cumulative.w
          || secondary_next_u < secondary_cumulative.w
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .NEGATIVE_INTERNAL_ENERGY}u
          );
          return;
        }
        // The block is velocity-only by admission. Preserving all three input
        // positions avoids resolving one face by increasing the opposite
        // overlap; the shared normal projection changes no tangential lane.
        output_state[center_index * 2u] = center_pos_mass;
        output_state[primary_index * 2u] = primary_pos_mass;
        output_state[secondary_index * 2u] = secondary_pos_mass;
        output_state[center_index * 2u + 1u] =
          vec4<f32>(three_block.center_velocity, center_next_u);
        output_state[primary_index * 2u + 1u] =
          vec4<f32>(three_block.primary_velocity, primary_next_u);
        output_state[secondary_index * 2u + 1u] =
          vec4<f32>(three_block.secondary_velocity, secondary_next_u);
        mechanical_matching_owner_record_mover(center_index);
        mechanical_matching_owner_record_mover(primary_index);
        mechanical_matching_owner_record_mover(secondary_index);
        energy_ledger[mechanical_energy_base(center_index) + 1u] =
          vec4<f32>(
            center_cumulative.x + three_block.center_kinetic_delta_j,
            center_next_pair_heat_j,
            center_next_wall_heat_j,
            center_cumulative.w
          );
        energy_ledger[mechanical_energy_base(primary_index) + 1u] =
          vec4<f32>(
            primary_cumulative.x + three_block.primary_kinetic_delta_j,
            primary_next_pair_heat_j,
            primary_next_wall_heat_j,
            primary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(secondary_index) + 1u] =
          vec4<f32>(
            secondary_cumulative.x + three_block.secondary_kinetic_delta_j,
            secondary_next_pair_heat_j,
            secondary_next_wall_heat_j,
            secondary_cumulative.w
          );
        csr_peers[three_block.center_primary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_primary_cursor]
          );
        csr_peers[three_block.primary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.primary_center_cursor]
          );
        csr_peers[three_block.center_secondary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_secondary_cursor]
          );
        csr_peers[three_block.secondary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.secondary_center_cursor]
          );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(pass_index)
          ],
          2u
        );
        if (count_completeness) {
          atomicAdd(
            &traversal_evidence[
              mechanical_matching_apply_count_word(pass_index)
            ],
            1u
          );
        }
        return;
      }
      let high_mass_ratio = low_pos_mass.w / high_pos_mass.w;
      let low_dx_unscaled = pair.barrier_dx;
      let high_dx_unscaled = -high_mass_ratio * low_dx_unscaled;
      let low_scale = particle_scales[low_index];
      let high_scale = particle_scales[high_index];
      let low_dx_scale = select(
        1.0,
        min(1.0, low_scale.w / max(length(low_dx_unscaled), 1.0e-30)),
        length(low_dx_unscaled) > 1.0e-12
      );
      let high_dx_scale = select(
        1.0,
        min(1.0, high_scale.w / max(length(high_dx_unscaled), 1.0e-30)),
        length(high_dx_unscaled) > 1.0e-12
      );
      let position_scale = min(low_dx_scale, high_dx_scale);
      let low_position = low_pos_mass.xyz
        + position_scale * low_dx_unscaled;
      let high_position = high_pos_mass.xyz
        + position_scale * high_dx_unscaled;
      let low_epoch_displacement = length(
        low_position - mechanical_solver_epoch_position(low_index)
      );
      let high_epoch_displacement = length(
        high_position - mechanical_solver_epoch_position(high_index)
      );
      let trust_tolerance_m = max(
        ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M},
        ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER}.0
          * 1.1920929e-7 * max(max(low_scale.z, high_scale.z), 1.0)
      );
      if (
        !mechanical_solver_finite3(low_position)
        || !mechanical_solver_finite3(high_position)
        || low_scale.z < 0.0
        || high_scale.z < 0.0
        || low_epoch_displacement > low_scale.z + trust_tolerance_m
        || high_epoch_displacement > high_scale.z + trust_tolerance_m
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let low_initial_dv = pair.barrier_dv;
      let high_initial_dv = -high_mass_ratio * low_initial_dv;
      let refinement = mechanical_matching_refine_wall_velocity_pair(
        low_index,
        high_index,
        low_position,
        high_position,
        low_vel_u.xyz,
        high_vel_u.xyz,
        low_pos_mass.w,
        high_pos_mass.w,
        low_initial_dv,
        high_initial_dv,
        low_constraint
      );
      if (refinement.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            refinement.failure_code,
            refinement.failure_code != 0u
          )
        );
        return;
      }
      let pair_kinetic_delta_j =
        refinement.low_pair_kinetic_delta_j
          + refinement.high_pair_kinetic_delta_j;
      let pair_heat_j = max(0.0, -pair_kinetic_delta_j);
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = low_pos_mass.w / pair_mass;
      let high_mass_fraction = high_pos_mass.w / pair_mass;
      let low_heat_j = pair_heat_j * low_mass_fraction;
      let high_heat_j = pair_heat_j * high_mass_fraction;
      let low_wall_heat_j = max(
        0.0,
        -refinement.low_wall_kinetic_delta_j
      );
      let high_wall_heat_j = max(
        0.0,
        -refinement.high_wall_kinetic_delta_j
      );
      let low_cumulative =
        energy_ledger[mechanical_energy_base(low_index) + 1u];
      let high_cumulative =
        energy_ledger[mechanical_energy_base(high_index) + 1u];
      let low_next_pair_heat_j = low_cumulative.y + low_heat_j;
      let high_next_pair_heat_j = high_cumulative.y + high_heat_j;
      let low_next_wall_heat_j = low_cumulative.z + low_wall_heat_j;
      let high_next_wall_heat_j = high_cumulative.z + high_wall_heat_j;
      let low_next_u = low_cumulative.w
        + (low_next_pair_heat_j + low_next_wall_heat_j) / low_pos_mass.w;
      let high_next_u = high_cumulative.w
        + (high_next_pair_heat_j + high_next_wall_heat_j) / high_pos_mass.w;
      if (
        !mechanical_solver_finite(low_next_u)
        || !mechanical_solver_finite(high_next_u)
        || low_next_u < low_cumulative.w
        || high_next_u < high_cumulative.w
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .NEGATIVE_INTERNAL_ENERGY}u
        );
        return;
      }
      output_state[low_index * 2u] =
        vec4<f32>(low_position, low_pos_mass.w);
      output_state[high_index * 2u] =
        vec4<f32>(high_position, high_pos_mass.w);
      output_state[low_index * 2u + 1u] =
        vec4<f32>(refinement.low_velocity, low_next_u);
      output_state[high_index * 2u + 1u] =
        vec4<f32>(refinement.high_velocity, high_next_u);
      mechanical_matching_owner_record_mover(low_index);
      mechanical_matching_owner_record_mover(high_index);
      energy_ledger[mechanical_energy_base(low_index) + 1u] = vec4<f32>(
        low_cumulative.x + refinement.low_pair_kinetic_delta_j,
        low_next_pair_heat_j,
        low_next_wall_heat_j,
        low_cumulative.w
      );
      energy_ledger[mechanical_energy_base(high_index) + 1u] = vec4<f32>(
        high_cumulative.x + refinement.high_pair_kinetic_delta_j,
        high_next_pair_heat_j,
        high_next_wall_heat_j,
        high_cumulative.w
      );
      csr_peers[low_cursor] = mechanical_matching_mark_edge_inactive(
        csr_peers[low_cursor]
      );
      csr_peers[high_cursor] = mechanical_matching_mark_edge_inactive(
        csr_peers[high_cursor]
      );
      atomicAdd(
        &traversal_evidence[
          mechanical_matching_applied_pair_count_word(pass_index)
        ],
        1u
      );
    }
  }
  if (count_completeness) {
    atomicAdd(
      &traversal_evidence[mechanical_matching_apply_count_word(pass_index)],
      1u
    );
  }
}

@compute @workgroup_size(64)
fn apply_matching_cleanup_edge(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  apply_matching_cleanup_edge_for_index(global_id.x, true);
}

fn mechanical_diagnostic_capture_target_local_base(
  pass_index: u32,
  target_slot: u32
) {
  let target_index = mechanical_diagnostic_target_index(target_slot);
  let selection =
    energy_ledger[mechanical_energy_base(target_index)];
  let selected_peer = bitcast<u32>(selection.x);
  let target_cursor = bitcast<u32>(selection.z);
  let row =
    mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
  var reciprocal_cursor = 0xffffffffu;
  var peer_mass_kg = 0.0;
  var flags =
    MECHANICAL_DIAGNOSTIC_TARGET_ROW_LOCAL_CAPTURE_COMPLETE;
  if (selected_peer < mechanical_params.particle_count) {
    flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_SELECTED;
    peer_mass_kg = input_state[selected_peer * 2u].w;
    let peer_selection =
      energy_ledger[mechanical_energy_base(selected_peer)];
    if (bitcast<u32>(peer_selection.x) == target_index) {
      flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_RECIPROCAL;
      reciprocal_cursor = bitcast<u32>(peer_selection.z);
    }
  }
  let input_pos_mass = input_state[target_index * 2u];
  let input_vel_u = input_state[target_index * 2u + 1u];
  let local_pos_mass = output_state[target_index * 2u];
  let local_vel_u = output_state[target_index * 2u + 1u];
  atomicStore(&mechanical_diagnostic_trace[row], pass_index);
  atomicStore(&mechanical_diagnostic_trace[row + 1u], target_index);
  atomicStore(&mechanical_diagnostic_trace[row + 2u], selected_peer);
  atomicStore(&mechanical_diagnostic_trace[row + 3u], target_cursor);
  atomicStore(&mechanical_diagnostic_trace[row + 4u], reciprocal_cursor);
  atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    11u,
    input_pos_mass.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    14u,
    input_vel_u.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    17u,
    local_pos_mass.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    20u,
    local_vel_u.xyz
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    31u,
    peer_mass_kg
  );
}

fn mechanical_diagnostic_capture_target_refinement(
  pass_index: u32,
  low_index: u32,
  high_index: u32,
  low_position: vec3<f32>,
  high_position: vec3<f32>,
  low_initial_velocity: vec3<f32>,
  high_initial_velocity: vec3<f32>,
  low_mass_kg: f32,
  high_mass_kg: f32,
  low_initial_dv: vec3<f32>,
  high_initial_dv: vec3<f32>,
  constraint: vec4<f32>,
  refinement: MechanicalMatchingVelocityRefinement
) {
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let low_round_zero_wall =
    mechanical_matching_project_wall_velocity(
      low_index,
      low_position,
      low_initial_velocity + low_initial_dv,
      low_mass_kg
    );
  let high_round_zero_wall =
    mechanical_matching_project_wall_velocity(
      high_index,
      high_position,
      high_initial_velocity + high_initial_dv,
      high_mass_kg
    );
  let pre_approach_residual_m_per_s = max(
    -dot(
      low_initial_velocity - high_initial_velocity,
      constraint_normal
    ),
    0.0
  );
  let post_approach_residual_m_per_s = max(
    -dot(
      refinement.low_velocity - refinement.high_velocity,
      constraint_normal
    ),
    0.0
  );
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    if (target_index != low_index && target_index != high_index) {
      continue;
    }
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    let target_is_low = target_index == low_index;
    let other_target =
      mechanical_diagnostic_target_index(1u - target_slot);
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED;
    if (target_is_low) {
      flags =
        flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW;
    }
    if (other_target == low_index || other_target == high_index) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS;
    }
    let target_round_zero_clipped = select(
      high_round_zero_wall.clipped,
      low_round_zero_wall.clipped,
      target_is_low
    );
    let peer_round_zero_clipped = select(
      low_round_zero_wall.clipped,
      high_round_zero_wall.clipped,
      target_is_low
    );
    if (target_round_zero_clipped != 0u) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_TARGET_WALL_CLIPPED;
    }
    if (peer_round_zero_clipped != 0u) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_PEER_WALL_CLIPPED;
    }
    atomicStore(
      &mechanical_diagnostic_trace[row + 5u],
      bitcast<u32>(i32(round(constraint.w)))
    );
    atomicStore(
      &mechanical_diagnostic_trace[row + 6u],
      refinement.round_count
    );
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      8u,
      constraint.xyz
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      29u,
      pre_approach_residual_m_per_s
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      30u,
      post_approach_residual_m_per_s
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      31u,
      select(low_mass_kg, high_mass_kg, target_is_low)
    );
  }
}

fn mechanical_diagnostic_accumulate_pair_impulse(
  pass_index: u32,
  first_index: u32,
  second_index: u32,
  first_impulse: vec3<f32>,
  second_impulse: vec3<f32>
) {
  if (
    !mechanical_solver_finite3(first_impulse)
    || !mechanical_solver_finite3(second_impulse)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let first_material_bits =
    bitcast<u32>(source_thermo[first_index * 3u].x);
  let second_material_bits =
    bitcast<u32>(source_thermo[second_index * 3u].x);
  if (first_material_bits != second_material_bits) {
    atomicAdd(&mechanical_diagnostic_trace[17u], 1u);
  }
  let material_a_bits = atomicLoad(&mechanical_diagnostic_trace[12u]);
  let material_b_bits = atomicLoad(&mechanical_diagnostic_trace[13u]);
  let first_is_a_second_is_b =
    first_material_bits == material_a_bits
      && second_material_bits == material_b_bits;
  let first_is_b_second_is_a =
    first_material_bits == material_b_bits
      && second_material_bits == material_a_bits;
  if (!first_is_a_second_is_b && !first_is_b_second_is_a) { return; }
  let impulse_a = select(
    second_impulse,
    first_impulse,
    first_is_a_second_is_b
  );
  let impulse_b = select(
    first_impulse,
    second_impulse,
    first_is_a_second_is_b
  );
  let material_a_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(20u),
    mechanical_diagnostic_trace_load_f32(21u),
    mechanical_diagnostic_trace_load_f32(22u)
  ) + impulse_a;
  let material_b_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(23u),
    mechanical_diagnostic_trace_load_f32(24u),
    mechanical_diagnostic_trace_load_f32(25u)
  ) + impulse_b;
  let momentum_residual = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(26u),
    mechanical_diagnostic_trace_load_f32(27u),
    mechanical_diagnostic_trace_load_f32(28u)
  ) + first_impulse + second_impulse;
  if (
    !mechanical_solver_finite3(material_a_impulse)
    || !mechanical_solver_finite3(material_b_impulse)
    || !mechanical_solver_finite3(momentum_residual)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  atomicAdd(&mechanical_diagnostic_trace[16u], 1u);
  atomicMin(&mechanical_diagnostic_trace[18u], pass_index);
  atomicStore(&mechanical_diagnostic_trace[19u], pass_index);
  mechanical_diagnostic_trace_store_f32(20u, material_a_impulse.x);
  mechanical_diagnostic_trace_store_f32(21u, material_a_impulse.y);
  mechanical_diagnostic_trace_store_f32(22u, material_a_impulse.z);
  mechanical_diagnostic_trace_store_f32(23u, material_b_impulse.x);
  mechanical_diagnostic_trace_store_f32(24u, material_b_impulse.y);
  mechanical_diagnostic_trace_store_f32(25u, material_b_impulse.z);
  mechanical_diagnostic_trace_store_f32(26u, momentum_residual.x);
  mechanical_diagnostic_trace_store_f32(27u, momentum_residual.y);
  mechanical_diagnostic_trace_store_f32(28u, momentum_residual.z);
  let lateral_impulse = length(vec2<f32>(impulse_a.x, impulse_a.z));
  if (
    lateral_impulse
      > mechanical_diagnostic_trace_load_f32(29u)
  ) {
    mechanical_diagnostic_trace_store_f32(29u, lateral_impulse);
    atomicStore(
      &mechanical_diagnostic_trace[30u],
      min(first_index, second_index)
    );
    atomicStore(
      &mechanical_diagnostic_trace[31u],
      max(first_index, second_index)
    );
  }
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED
  );
}

fn mechanical_diagnostic_capture_target_three_block(
  pass_index: u32,
  block: MechanicalMatchingThreeBlockResult
) {
  if (!mechanical_diagnostic_target_tail_header_valid()) { return; }
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    let target_is_tertiary = block.member_count == 4u
      && target_index == block.tertiary_index;
    if (
      target_index != block.center_index
      && target_index != block.primary_index
      && target_index != block.secondary_index
      && !target_is_tertiary
    ) { continue; }
    let selection =
      energy_ledger[mechanical_energy_base(target_index)];
    let selected_peer = bitcast<u32>(selection.x);
    let selected_cursor = bitcast<u32>(selection.z);
    if (
      selected_peer >= mechanical_params.particle_count
      || selected_cursor >= arrayLength(&matching_constraints)
      || selected_cursor >= arrayLength(&csr_peers)
      || mechanical_solver_peer_index(csr_peers[selected_cursor])
        != selected_peer
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_index = min(target_index, selected_peer);
    let high_index = max(target_index, selected_peer);
    let constraint = matching_constraints[selected_cursor];
    let constraint_normal =
      mechanical_matching_constraint_normal(constraint);
    let low_input_velocity = input_state[low_index * 2u + 1u].xyz;
    let high_input_velocity = input_state[high_index * 2u + 1u].xyz;
    let low_output_velocity = output_state[low_index * 2u + 1u].xyz;
    let high_output_velocity = output_state[high_index * 2u + 1u].xyz;
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_THREE_BLOCK_APPLIED;
    if (target_index == low_index) {
      flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW;
    }
    let other_target =
      mechanical_diagnostic_target_index(1u - target_slot);
    if (other_target == low_index || other_target == high_index) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS;
    }
    atomicStore(
      &mechanical_diagnostic_trace[row + 5u],
      bitcast<u32>(i32(round(constraint.w)))
    );
    atomicStore(&mechanical_diagnostic_trace[row + 6u], 1u);
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      8u,
      constraint.xyz
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      29u,
      max(
        -dot(
          low_input_velocity - high_input_velocity,
          constraint_normal
        ),
        0.0
      )
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      30u,
      max(
        -dot(
          low_output_velocity - high_output_velocity,
          constraint_normal
        ),
        0.0
      )
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      31u,
      input_state[selected_peer * 2u].w
    );
  }
}

// Diagnostic-only deterministic replay. It runs in a separate dispatch after
// every apply invocation has finished, so it may safely repurpose the dead
// selection y/z/w lanes without racing the production matching dispatch.
// Replaying the exact pure helper also proves the traced impulse excludes wall
// momentum while the production output includes the interleaved wall clips.
@compute @workgroup_size(1)
fn replay_matching_cleanup_refinement_trace() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_apply_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let target_tail_valid =
    mechanical_diagnostic_target_tail_header_valid();
  if (target_tail_valid) {
    for (
      var target_slot = 0u;
      target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
      target_slot = target_slot + 1u
    ) {
      mechanical_diagnostic_capture_target_local_base(
        pass_index,
        target_slot
      );
    }
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let prior_local_capture_count = atomicAdd(
      &mechanical_diagnostic_trace[header + 8u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
    );
    if (
      prior_local_capture_count
          + MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
        == ${solverBudget.cleanupPassBudget
          * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE
      );
    }
  }
  let published_total = atomicLoad(&graph_control[12u]);
  if (
    published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (
    var low_index = 0u;
    low_index < mechanical_params.particle_count;
    low_index = low_index + 1u
  ) {
    let selection = energy_ledger[mechanical_energy_base(low_index)];
    let high_index = bitcast<u32>(selection.x);
    if (
      high_index <= low_index
      || high_index >= mechanical_params.particle_count
    ) { continue; }
    let high_selection =
      energy_ledger[mechanical_energy_base(high_index)];
    if (bitcast<u32>(high_selection.x) != low_index) { continue; }
    let low_cursor = bitcast<u32>(selection.z);
    let high_cursor = bitcast<u32>(high_selection.z);
    if (
      low_cursor >= arrayLength(&matching_constraints)
      || high_cursor >= arrayLength(&matching_constraints)
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_constraint = matching_constraints[low_cursor];
    let high_constraint = matching_constraints[high_cursor];
    let low_pos_mass = input_state[low_index * 2u];
    let high_pos_mass = input_state[high_index * 2u];
    let low_initial_velocity = input_state[low_index * 2u + 1u].xyz;
    let high_initial_velocity = input_state[high_index * 2u + 1u].xyz;
    if (
      !(low_pos_mass.w > 0.0)
      || !(high_pos_mass.w > 0.0)
      || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
      || !mechanical_matching_constraint_code_valid(low_constraint)
      || !mechanical_matching_constraint_code_valid(high_constraint)
      || low_constraint.w != high_constraint.w
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let terminal_path_window = pass_index + 16u
      >= ${solverBudget.cleanupPassBudget}u;
    var three_block = mechanical_matching_zero_three_block();
    if (terminal_path_window) {
      three_block = mechanical_matching_four_path_block(
        low_index,
        high_index,
        published_total
      );
    }
    if (three_block.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (
      three_block.applied != 0u
      && three_block.topology == 1u
      && three_block.path_owner == 0u
    ) { continue; }
    if (three_block.applied == 0u) {
      three_block = mechanical_matching_three_block(
        low_index,
        high_index,
        low_cursor,
        high_cursor,
        published_total
      );
    }
    if (three_block.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let primary_markers_inactive =
      mechanical_solver_edge_inactive(csr_peers[low_cursor])
      && mechanical_solver_edge_inactive(csr_peers[high_cursor]);
    if (
      three_block.applied != 0u
      && three_block.member_count == 4u
    ) {
      let all_block_markers_inactive = primary_markers_inactive
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_secondary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.secondary_center_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_tertiary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.tertiary_center_cursor]
        );
      let center_output_pos_mass =
        output_state[three_block.center_index * 2u];
      let primary_output_pos_mass =
        output_state[three_block.primary_index * 2u];
      let secondary_output_pos_mass =
        output_state[three_block.secondary_index * 2u];
      let tertiary_output_pos_mass =
        output_state[three_block.tertiary_index * 2u];
      let center_output_velocity =
        output_state[three_block.center_index * 2u + 1u].xyz;
      let primary_output_velocity =
        output_state[three_block.primary_index * 2u + 1u].xyz;
      let secondary_output_velocity =
        output_state[three_block.secondary_index * 2u + 1u].xyz;
      let tertiary_output_velocity =
        output_state[three_block.tertiary_index * 2u + 1u].xyz;
      let block_replay_conditioning = max(
        max(
          max(
            length(center_output_velocity),
            length(primary_output_velocity)
          ),
          max(
            length(secondary_output_velocity),
            length(tertiary_output_velocity)
          )
        ),
        max(
          max(
            length(three_block.center_velocity),
            length(three_block.primary_velocity)
          ),
          max(
            length(three_block.secondary_velocity),
            length(three_block.tertiary_velocity)
          )
        )
      );
      let block_replay_tolerance_m_per_s = max(
        1.0e-6,
        64.0 * 1.1920929e-7 * max(block_replay_conditioning, 1.0)
      );
      if (
        !all_block_markers_inactive
        || any(
          center_output_pos_mass
            != input_state[three_block.center_index * 2u]
        )
        || any(
          primary_output_pos_mass
            != input_state[three_block.primary_index * 2u]
        )
        || any(
          secondary_output_pos_mass
            != input_state[three_block.secondary_index * 2u]
        )
        || any(
          tertiary_output_pos_mass
            != input_state[three_block.tertiary_index * 2u]
        )
        || length(
          center_output_velocity - three_block.center_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          primary_output_velocity - three_block.primary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          secondary_output_velocity - three_block.secondary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          tertiary_output_velocity - three_block.tertiary_velocity
        ) > block_replay_tolerance_m_per_s
      ) {
        atomicOr(
          &mechanical_diagnostic_trace[2u],
          MECHANICAL_DIAGNOSTIC_TRACE_INVALID
        );
        return;
      }
      if (target_tail_valid) {
        mechanical_diagnostic_capture_target_three_block(
          pass_index,
          three_block
        );
      }
      mechanical_diagnostic_accumulate_pair_impulse(
        pass_index,
        three_block.secondary_index,
        three_block.center_index,
        three_block.secondary_impulse,
        three_block.center_secondary_impulse
      );
      if (three_block.topology == 0u) {
        mechanical_diagnostic_accumulate_pair_impulse(
          pass_index,
          three_block.tertiary_index,
          three_block.center_index,
          three_block.tertiary_impulse,
          three_block.center_tertiary_impulse
        );
      }
      let center_selection =
        energy_ledger[mechanical_energy_base(three_block.center_index)];
      let primary_selection =
        energy_ledger[mechanical_energy_base(three_block.primary_index)];
      let secondary_selection =
        energy_ledger[mechanical_energy_base(three_block.secondary_index)];
      let tertiary_selection =
        energy_ledger[mechanical_energy_base(three_block.tertiary_index)];
      energy_ledger[mechanical_energy_base(three_block.center_index)] =
        vec4<f32>(
          center_selection.x,
          three_block.center_primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.primary_index)] =
        vec4<f32>(
          primary_selection.x,
          three_block.primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.secondary_index)] =
        vec4<f32>(
          secondary_selection.x,
          select(
            three_block.secondary_impulse,
            three_block.center_tertiary_impulse,
            three_block.topology == 1u
          )
        );
      energy_ledger[mechanical_energy_base(three_block.tertiary_index)] =
        vec4<f32>(
          tertiary_selection.x,
          three_block.tertiary_impulse
        );
      continue;
    }
    if (three_block.applied != 0u) {
      let all_block_markers_inactive =
        primary_markers_inactive
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_secondary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.secondary_center_cursor]
        );
      let center_output_pos_mass =
        output_state[three_block.center_index * 2u];
      let primary_output_pos_mass =
        output_state[three_block.primary_index * 2u];
      let secondary_output_pos_mass =
        output_state[three_block.secondary_index * 2u];
      let center_output_velocity =
        output_state[three_block.center_index * 2u + 1u].xyz;
      let primary_output_velocity =
        output_state[three_block.primary_index * 2u + 1u].xyz;
      let secondary_output_velocity =
        output_state[three_block.secondary_index * 2u + 1u].xyz;
      let block_replay_conditioning = max(
        max(
          length(center_output_velocity),
          length(primary_output_velocity)
        ),
        max(
          length(secondary_output_velocity),
          max(
            length(three_block.center_velocity),
            max(
              length(three_block.primary_velocity),
              length(three_block.secondary_velocity)
            )
          )
        )
      );
      let block_replay_tolerance_m_per_s = max(
        1.0e-6,
        64.0 * 1.1920929e-7 * max(block_replay_conditioning, 1.0)
      );
      if (
        !all_block_markers_inactive
        || any(
          center_output_pos_mass
            != input_state[three_block.center_index * 2u]
        )
        || any(
          primary_output_pos_mass
            != input_state[three_block.primary_index * 2u]
        )
        || any(
          secondary_output_pos_mass
            != input_state[three_block.secondary_index * 2u]
        )
        || length(
          center_output_velocity - three_block.center_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          primary_output_velocity - three_block.primary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          secondary_output_velocity - three_block.secondary_velocity
        ) > block_replay_tolerance_m_per_s
      ) {
        atomicOr(
          &mechanical_diagnostic_trace[2u],
          MECHANICAL_DIAGNOSTIC_TRACE_INVALID
        );
        return;
      }
      if (target_tail_valid) {
        mechanical_diagnostic_capture_target_three_block(
          pass_index,
          three_block
        );
      }
      // Keep the primary mutual edge in the established scratch ABI. The
      // secondary selector is non-mutual, so account that edge directly and
      // separately rather than folding the center's net impulse into one pair.
      mechanical_diagnostic_accumulate_pair_impulse(
        pass_index,
        three_block.secondary_index,
        three_block.center_index,
        three_block.secondary_impulse,
        three_block.center_secondary_impulse
      );
      let center_selection =
        energy_ledger[mechanical_energy_base(three_block.center_index)];
      let primary_selection =
        energy_ledger[mechanical_energy_base(three_block.primary_index)];
      let secondary_selection =
        energy_ledger[mechanical_energy_base(three_block.secondary_index)];
      energy_ledger[mechanical_energy_base(three_block.center_index)] =
        vec4<f32>(
          center_selection.x,
          three_block.center_primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.primary_index)] =
        vec4<f32>(
          primary_selection.x,
          three_block.primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.secondary_index)] =
        vec4<f32>(
          secondary_selection.x,
          three_block.secondary_impulse
        );
      continue;
    }
    // An unused support may already be an inactive reservation from an
    // earlier pass, so its post-apply marker has no unique expected polarity.
    // The mutual primary is the only edge this fallback must retire.
    if (!primary_markers_inactive) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair_mass_kg = low_pos_mass.w + high_pos_mass.w;
    let initial_relative_dv = mechanical_matching_relative_velocity_delta(
      low_initial_velocity - high_initial_velocity,
      low_constraint
    );
    let low_initial_dv =
      high_pos_mass.w / pair_mass_kg * initial_relative_dv;
    let high_initial_dv =
      -(low_pos_mass.w / high_pos_mass.w) * low_initial_dv;
    let refinement = mechanical_matching_refine_wall_velocity_pair(
      low_index,
      high_index,
      output_state[low_index * 2u].xyz,
      output_state[high_index * 2u].xyz,
      low_initial_velocity,
      high_initial_velocity,
      low_pos_mass.w,
      high_pos_mass.w,
      low_initial_dv,
      high_initial_dv,
      low_constraint
    );
    let low_output_velocity = output_state[low_index * 2u + 1u].xyz;
    let high_output_velocity = output_state[high_index * 2u + 1u].xyz;
    let replay_conditioning = max(
      max(length(low_output_velocity), length(high_output_velocity)),
      max(
        length(refinement.low_velocity),
        length(refinement.high_velocity)
      )
    );
    let replay_tolerance_m_per_s = max(
      1.0e-6,
      64.0 * 1.1920929e-7 * max(replay_conditioning, 1.0)
    );
    if (
      refinement.valid == 0u
      || !mechanical_solver_finite3(refinement.low_pair_impulse)
      || !mechanical_solver_finite3(refinement.high_pair_impulse)
      || length(refinement.low_velocity - low_output_velocity)
        > replay_tolerance_m_per_s
      || length(refinement.high_velocity - high_output_velocity)
        > replay_tolerance_m_per_s
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (target_tail_valid) {
      mechanical_diagnostic_capture_target_refinement(
        pass_index,
        low_index,
        high_index,
        output_state[low_index * 2u].xyz,
        output_state[high_index * 2u].xyz,
        low_initial_velocity,
        high_initial_velocity,
        low_pos_mass.w,
        high_pos_mass.w,
        low_initial_dv,
        high_initial_dv,
        low_constraint,
        refinement
      );
    }
    energy_ledger[mechanical_energy_base(low_index)] = vec4<f32>(
      selection.x,
      refinement.low_pair_impulse
    );
    energy_ledger[mechanical_energy_base(high_index)] = vec4<f32>(
      high_selection.x,
      refinement.high_pair_impulse
    );
  }
}

fn mechanical_diagnostic_capture_target_post_wall(pass_index: u32) {
  if (!mechanical_diagnostic_target_tail_header_valid()) { return; }
  let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_wall_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
    );
    return;
  }
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    let post_wall_pos_mass = output_state[target_index * 2u];
    let post_wall_vel_u = output_state[target_index * 2u + 1u];
    let local_position = vec3<f32>(
      mechanical_diagnostic_trace_load_f32(row + 17u),
      mechanical_diagnostic_trace_load_f32(row + 18u),
      mechanical_diagnostic_trace_load_f32(row + 19u)
    );
    let local_velocity = vec3<f32>(
      mechanical_diagnostic_trace_load_f32(row + 20u),
      mechanical_diagnostic_trace_load_f32(row + 21u),
      mechanical_diagnostic_trace_load_f32(row + 22u)
    );
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      23u,
      post_wall_pos_mass.xyz
    );
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      26u,
      post_wall_vel_u.xyz
    );
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CAPTURE_COMPLETE;
    if (
      any(post_wall_pos_mass.xyz != local_position)
      || any(post_wall_vel_u.xyz != local_velocity)
    ) {
      flags =
        flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CHANGED;
    }
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
  }
  let prior_post_wall_capture_count = atomicAdd(
    &mechanical_diagnostic_trace[header + 9u],
    MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
  );
  if (
    prior_post_wall_capture_count
        + MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      == ${solverBudget.cleanupPassBudget
        * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE
    );
  }
}

// Diagnostic-only single-invocation reduction. The apply dispatch publishes
// each mutual pair's complete local-refinement impulse through the replay
// dispatch into its now-dead selection scratch row. After the wall dispatch,
// this reducer also captures the targeted post-wall state. Pair impulses
// exclude wall momentum by construction. No production pipeline binds the
// trace slot.
@compute @workgroup_size(1)
fn trace_matching_cleanup_apply() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  if (
    (
      atomicLoad(&mechanical_diagnostic_trace[2u])
        & MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    ) != 0u
  ) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_apply_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  mechanical_diagnostic_capture_target_post_wall(pass_index);
  let material_a_bits = atomicLoad(&mechanical_diagnostic_trace[12u]);
  let material_b_bits = atomicLoad(&mechanical_diagnostic_trace[13u]);
  var material_a_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(20u),
    mechanical_diagnostic_trace_load_f32(21u),
    mechanical_diagnostic_trace_load_f32(22u)
  );
  var material_b_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(23u),
    mechanical_diagnostic_trace_load_f32(24u),
    mechanical_diagnostic_trace_load_f32(25u)
  );
  var momentum_residual = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(26u),
    mechanical_diagnostic_trace_load_f32(27u),
    mechanical_diagnostic_trace_load_f32(28u)
  );
  var largest_lateral_impulse =
    mechanical_diagnostic_trace_load_f32(29u);
  var configured_pair_count =
    atomicLoad(&mechanical_diagnostic_trace[16u]);
  var cross_material_pair_count =
    atomicLoad(&mechanical_diagnostic_trace[17u]);
  var first_configured_pass =
    atomicLoad(&mechanical_diagnostic_trace[18u]);
  var last_configured_pass =
    atomicLoad(&mechanical_diagnostic_trace[19u]);
  var largest_low_index =
    atomicLoad(&mechanical_diagnostic_trace[30u]);
  var largest_high_index =
    atomicLoad(&mechanical_diagnostic_trace[31u]);
  var pass_configured_pair_count = 0u;
  for (
    var low_index = 0u;
    low_index < mechanical_params.particle_count;
    low_index = low_index + 1u
  ) {
    let selection = energy_ledger[mechanical_energy_base(low_index)];
    let high_index = bitcast<u32>(selection.x);
    if (
      high_index <= low_index
      || high_index >= mechanical_params.particle_count
    ) { continue; }
    let high_selection =
      energy_ledger[mechanical_energy_base(high_index)];
    if (bitcast<u32>(high_selection.x) != low_index) { continue; }
    let low_impulse = selection.yzw;
    let high_impulse = high_selection.yzw;
    if (
      !mechanical_solver_finite3(low_impulse)
      || !mechanical_solver_finite3(high_impulse)
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_material_bits =
      bitcast<u32>(source_thermo[low_index * 3u].x);
    let high_material_bits =
      bitcast<u32>(source_thermo[high_index * 3u].x);
    if (low_material_bits != high_material_bits) {
      cross_material_pair_count = cross_material_pair_count + 1u;
    }
    let low_is_a_high_is_b =
      low_material_bits == material_a_bits
      && high_material_bits == material_b_bits;
    let low_is_b_high_is_a =
      low_material_bits == material_b_bits
      && high_material_bits == material_a_bits;
    if (!low_is_a_high_is_b && !low_is_b_high_is_a) { continue; }
    configured_pair_count = configured_pair_count + 1u;
    pass_configured_pair_count = pass_configured_pair_count + 1u;
    first_configured_pass = min(first_configured_pass, pass_index);
    last_configured_pass = pass_index;
    let impulse_a = select(
      high_impulse,
      low_impulse,
      low_is_a_high_is_b
    );
    let impulse_b = select(
      low_impulse,
      high_impulse,
      low_is_a_high_is_b
    );
    material_a_impulse = material_a_impulse + impulse_a;
    material_b_impulse = material_b_impulse + impulse_b;
    momentum_residual = momentum_residual + low_impulse + high_impulse;
    let lateral_impulse = length(vec2<f32>(impulse_a.x, impulse_a.z));
    if (lateral_impulse > largest_lateral_impulse) {
      largest_lateral_impulse = lateral_impulse;
      largest_low_index = low_index;
      largest_high_index = high_index;
    }
  }
  if (
    !mechanical_solver_finite3(material_a_impulse)
    || !mechanical_solver_finite3(material_b_impulse)
    || !mechanical_solver_finite3(momentum_residual)
    || !mechanical_solver_finite(largest_lateral_impulse)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  atomicStore(&mechanical_diagnostic_trace[16u], configured_pair_count);
  atomicStore(
    &mechanical_diagnostic_trace[17u],
    cross_material_pair_count
  );
  atomicStore(
    &mechanical_diagnostic_trace[18u],
    first_configured_pass
  );
  atomicStore(
    &mechanical_diagnostic_trace[19u],
    last_configured_pass
  );
  mechanical_diagnostic_trace_store_f32(20u, material_a_impulse.x);
  mechanical_diagnostic_trace_store_f32(21u, material_a_impulse.y);
  mechanical_diagnostic_trace_store_f32(22u, material_a_impulse.z);
  mechanical_diagnostic_trace_store_f32(23u, material_b_impulse.x);
  mechanical_diagnostic_trace_store_f32(24u, material_b_impulse.y);
  mechanical_diagnostic_trace_store_f32(25u, material_b_impulse.z);
  mechanical_diagnostic_trace_store_f32(26u, momentum_residual.x);
  mechanical_diagnostic_trace_store_f32(27u, momentum_residual.y);
  mechanical_diagnostic_trace_store_f32(28u, momentum_residual.z);
  mechanical_diagnostic_trace_store_f32(29u, largest_lateral_impulse);
  atomicStore(&mechanical_diagnostic_trace[30u], largest_low_index);
  atomicStore(&mechanical_diagnostic_trace[31u], largest_high_index);
  atomicAdd(&mechanical_diagnostic_trace[14u], 1u);
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_IMPULSE_FINITE
  );
  if (pass_configured_pair_count > 0u) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED
    );
  }
}

fn project_matching_cleanup_walls_for_index(self_index: u32) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_apply_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let pos_mass = output_state[self_index * 2u];
  let vel_u = output_state[self_index * 2u + 1u];
  var position = pos_mass.xyz;
  var velocity = vel_u.xyz;
  let rest_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = vec3<f32>(wall_clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (position.x < lower.x) {
    position.x = lower.x;
  } else if (position.x > upper.x) {
    position.x = upper.x;
  }
  if (position.y < lower.y) {
    position.y = lower.y;
  } else if (position.y > upper.y) {
    position.y = upper.y;
  }
  if (position.z < lower.z) {
    position.z = lower.z;
  } else if (position.z > upper.z) {
    position.z = upper.z;
  }
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) { velocity.x = 0.0; }
  if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) { velocity.x = 0.0; }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) { velocity.y = 0.0; }
  if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) { velocity.y = 0.0; }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) { velocity.z = 0.0; }
  if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) { velocity.z = 0.0; }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(vel_u.xyz, vel_u.xyz)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(vel_u.xyz, vel_u.xyz)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  let scale = particle_scales[self_index];
  let epoch_displacement_m = length(
    position - mechanical_solver_epoch_position(self_index)
  );
  let trust_tolerance_m = max(
    ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M},
    ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER}.0
      * 1.1920929e-7 * max(scale.z, 1.0)
  );
  if (
    !mechanical_solver_finite3(position)
    || !mechanical_solver_finite3(velocity)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || scale.z < 0.0
    || wall_kinetic_delta_j > wall_tolerance_j
    || epoch_displacement_m > scale.z + trust_tolerance_m
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(wall_kinetic_delta_j)
          && wall_kinetic_delta_j > wall_tolerance_j
      )
    );
    return;
  }
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let cumulative = energy_ledger[mechanical_energy_base(self_index) + 1u];
  let next_wall_heat_j = cumulative.z + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w
      + (cumulative.y + next_wall_heat_j) / pos_mass.w,
    pos_mass.w > 0.0
  );
  // Wall contact only dissipates; see the gauge note at the pair sites.
  if (
    !mechanical_solver_finite(next_u)
    || next_u < select(vel_u.w, cumulative.w, pos_mass.w > 0.0)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
        .NEGATIVE_INTERNAL_ENERGY}u
    );
    return;
  }
  if (
    any(position != pos_mass.xyz)
    || any(velocity != vel_u.xyz)
  ) {
    // Pair activity reads only endpoint positions and velocities; a wall
    // projection that changed either makes this particle a mover for the
    // next pass's moved-set expansion.
    mechanical_matching_owner_record_mover(self_index);
  }
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, next_u);
  energy_ledger[mechanical_energy_base(self_index) + 1u] = vec4<f32>(
    cumulative.x,
    cumulative.y,
    next_wall_heat_j,
    cumulative.w
  );
  particle_scales[self_index].w = max(0.0, scale.z - epoch_displacement_m);
  atomicAdd(
    &traversal_evidence[mechanical_matching_wall_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn project_matching_cleanup_walls(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  project_matching_cleanup_walls_for_index(global_id.x);
}

fn finalize_matching_cleanup_pass_body() {
  if (!mechanical_solver_full_path_enabled()) { return; }
  if (arrayLength(&matching_cleanup_dispatch) < 3u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
      &traversal_evidence[mechanical_matching_wall_count_word(pass_index)]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_applied_pair_count_word(pass_index)
      ]
    ) == 0u
  ) {
    let terminal_position_ratio = atomicLoad(
      &traversal_evidence[
        mechanical_matching_max_position_ratio_word(pass_index)
      ]
    );
    let terminal_velocity_residual = atomicLoad(
      &traversal_evidence[
        mechanical_matching_max_velocity_residual_word(pass_index)
      ]
    );
    if (
      bitcast<f32>(terminal_position_ratio) <= 1.0
      && bitcast<f32>(terminal_velocity_residual) <= ${
        SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
          .toExponential(1)
      }
      && (pass_index & 1u)
        == ${((solverBudget.cleanupPassBudget - 1) & 1)}u
    ) {
      // No unprocessed violated edge remains and the all-edge residual is
      // certified. Convergence is accepted only on the fixed terminal-buffer
      // parity. An otherwise-terminal opposite-parity pass advances once so
      // the following conflict-free copy publishes the identical state into
      // the host's deterministic final buffer. Then latch the particle
      // dispatch to zero and synthesize the unused evidence tail on-GPU.
      for (
        var completed_pass = pass_index + 1u;
        completed_pass
          < ${solverBudget.cleanupPassBudget}u;
        completed_pass = completed_pass + 1u
      ) {
        atomicStore(
          &traversal_evidence[
            mechanical_matching_selection_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_copy_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_apply_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_wall_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(completed_pass)
          ],
          0u
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_position_ratio_word(completed_pass)
          ],
          terminal_position_ratio
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_velocity_residual_word(completed_pass)
          ],
          terminal_velocity_residual
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_contact_count_word(completed_pass)
          ],
          atomicLoad(
            &traversal_evidence[
              mechanical_matching_contact_count_word(pass_index)
            ]
          )
        );
      }
      atomicStore(
        &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
          .matchingCleanupPassCount}u],
        ${solverBudget.cleanupPassBudget}u
      );
      atomicOr(
        &graph_control[15u],
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
      );
      atomicStore(&matching_cleanup_dispatch[0u], 0u);
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
      return;
    }
    // A zero matching with residual remaining is the delimiter between fixed
    // edge-order sweeps: every currently violated edge was already processed.
    // Advance once; the next selection pass clears the private CSR markers.
  }
  let prior_pass = atomicAdd(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupPassCount}u],
    1u
  );
  if (
    prior_pass + 1u
      == ${solverBudget.cleanupPassBudget}u
  ) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.MATCHING_CLEANUP}u
    );
  }
}

@compute @workgroup_size(1)
fn finalize_matching_cleanup_pass() {
  finalize_matching_cleanup_pass_body();
}

@compute @workgroup_size(64)
fn restore_matching_cleanup_trust(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let final_pass =
    ${solverBudget.cleanupPassBudget - 1}u;
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || arrayLength(&matching_constraints)
      < mechanical_params.directed_pair_capacity
    || mechanical_matching_current_pass()
      != ${solverBudget.cleanupPassBudget}u
    || atomicLoad(
      &traversal_evidence[mechanical_matching_wall_count_word(final_pass)]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) == 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  particle_scales[self_index].z = particle_scales[self_index].x;
  particle_scales[self_index].w = particle_scales[self_index].y;
  atomicAdd(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupTrustRestoreCount}u],
    1u
  );
  if (self_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
        .MATCHING_TRUST_RESTORED}u
    );
  }
}

@compute @workgroup_size(64)
fn verify_contact_residual(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  let graph_was_verified =
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    ) != 0u;
  let row_bounds_valid = graph_was_verified
    && total <= mechanical_params.directed_pair_capacity
    && total <= arrayLength(&csr_peers)
    && begin <= end
    && end <= total;
  if (row_bounds_valid) {
    // Cleanup is unconditional once CSR bounds are known. Even a prior
    // solver failure must not leave solver-private high bits in the retained
    // public peer buffer.
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      csr_peers[cursor] = mechanical_solver_peer_index(csr_peers[cursor]);
    }
  }
  let final_iteration =
    mechanical_params.solver_iteration_count - 1u;
  let solver_stages_incomplete = (
    atomicLoad(
      &graph_control[mechanical_solve_count_word(final_iteration)]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & mechanical_iteration_stage_bit(final_iteration)
    ) == 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
    ) == 0u
    || atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) != ${solverBudget.cleanupPassBudget}u
    || atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) == 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
          .MATCHING_TRUST_RESTORED}u
    ) == 0u
  );
  if (solver_stages_incomplete) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  // Residual workgroups publish into one sticky word. A sibling can report a
  // real residual before this invocation reaches the preflight; preserve that
  // primary bit without relabelling completed solver work as incomplete.
  if (atomicLoad(&graph_control[14u]) != 0u) { return; }
  if (!row_bounds_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var max_position_residual = 0.0;
  var max_velocity_residual = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    // Certify the same immutable supporting halfspace and swept response frame
    // used by selection and application. Recomputing finite-volume geometry
    // here would certify a different constraint family than cleanup solved.
    let low_index = min(self_index, other_index);
    let high_index = max(self_index, other_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    if (pair.unilateral == 1u) {
      let self_volume = max(
        source_mechanics[self_index * 8u + 4u].w,
        0.0
      );
      let other_volume = max(
        source_mechanics[other_index * 8u + 4u].w,
        0.0
      );
      let rest_distance = 0.5 * (
        mechanical_solver_cbrt(self_volume)
          + mechanical_solver_cbrt(other_volume)
      );
      let position_tolerance = max(
        1.0e-5,
        ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
          * rest_distance
      );
      if (pair.position_residual > position_tolerance) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.POSITION_RESIDUAL}u
        );
      }
      if (pair.velocity_residual > ${
        SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
          .toExponential(1)
      }) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.VELOCITY_RESIDUAL}u
        );
      }
      max_position_residual = max(
        max_position_residual,
        pair.position_residual
      );
      max_velocity_residual = max(
        max_velocity_residual,
        pair.velocity_residual
      );
    }
  }
  atomicMax(
    &graph_control[27u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &graph_control[28u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicMax(
    &traversal_evidence[30u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &traversal_evidence[31u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicAdd(&graph_control[17u], 1u);
  if (self_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    );
  }
}

// The production verifier is fail-closed and siblings may observe its sticky
// bit before scanning their own rows. These diagnostic passes independently
// measure the complete terminal constraint set, then choose one deterministic
// global CSR cursor and materialize it without changing production evidence.
@compute @workgroup_size(64)
fn measure_terminal_residual_trace(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  if (self_index == 0u) {
    atomicStore(
      &mechanical_diagnostic_trace[15u],
      atomicLoad(&graph_control[14u])
    );
    atomicStore(
      &mechanical_diagnostic_trace[62u],
      atomicLoad(&graph_control[28u])
    );
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_TERMINAL_MEASURED
    );
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > arrayLength(&csr_peers)) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    if (other_index >= mechanical_params.particle_count) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair = mechanical_matching_constraint_pair(
      min(self_index, other_index),
      max(self_index, other_index),
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (pair.active_pair == 0u || pair.unilateral == 0u) { continue; }
    atomicMax(
      &mechanical_diagnostic_trace[32u],
      bitcast<u32>(pair.velocity_residual)
    );
    atomicAdd(&mechanical_diagnostic_trace[63u], 1u);
  }
}

@compute @workgroup_size(64)
fn select_terminal_residual_trace(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let terminal_max_bits =
    atomicLoad(&mechanical_diagnostic_trace[32u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > arrayLength(&csr_peers)) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    if (other_index >= mechanical_params.particle_count) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair = mechanical_matching_constraint_pair(
      min(self_index, other_index),
      max(self_index, other_index),
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (
      pair.active_pair == 1u
      && pair.unilateral == 1u
      && bitcast<u32>(pair.velocity_residual) == terminal_max_bits
    ) {
      atomicMin(&mechanical_diagnostic_trace[33u], cursor);
    }
  }
}

@compute @workgroup_size(1)
fn materialize_terminal_residual_trace() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let winner_cursor = atomicLoad(&mechanical_diagnostic_trace[33u]);
  let production_max_bits = atomicLoad(&mechanical_diagnostic_trace[62u]);
  let measured_max_bits = atomicLoad(&mechanical_diagnostic_trace[32u]);
  if (production_max_bits == measured_max_bits) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_PRODUCTION_MAX_MATCH
    );
  }
  if (mechanical_diagnostic_target_tail_header_valid()) {
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let expected_target_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[14u])
        * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    let local_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[header + 8u]);
    let post_wall_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[header + 9u]);
    if (
      local_capture_count == expected_target_capture_count
      && post_wall_capture_count == expected_target_capture_count
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE
          | MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE
      );
    } else {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
      );
    }
  }
  if (winner_cursor == 0xffffffffu) {
    if (atomicLoad(&mechanical_diagnostic_trace[63u]) != 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
    }
    return;
  }
  var source_index = 0xffffffffu;
  for (
    var candidate = 0u;
    candidate < mechanical_params.particle_count;
    candidate = candidate + 1u
  ) {
    let begin = source_offsets[candidate];
    let end = source_offsets[candidate + 1u];
    if (winner_cursor >= begin && winner_cursor < end) {
      source_index = candidate;
      break;
    }
  }
  if (
    source_index == 0xffffffffu
    || winner_cursor >= arrayLength(&csr_peers)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let peer_index =
    mechanical_solver_peer_index(csr_peers[winner_cursor]);
  if (peer_index >= mechanical_params.particle_count) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let low_index = min(source_index, peer_index);
  let high_index = max(source_index, peer_index);
  var reciprocal_cursor = 0xffffffffu;
  let peer_begin = source_offsets[peer_index];
  let peer_end = source_offsets[peer_index + 1u];
  for (
    var cursor = peer_begin;
    cursor < peer_end;
    cursor = cursor + 1u
  ) {
    if (
      mechanical_solver_peer_index(csr_peers[cursor]) == source_index
    ) {
      reciprocal_cursor = cursor;
      break;
    }
  }
  let pair = mechanical_matching_constraint_pair(
    low_index,
    high_index,
    winner_cursor
  );
  let constraint = matching_constraints[winner_cursor];
  if (
    reciprocal_cursor == 0xffffffffu
    || pair.valid == 0u
    || pair.active_pair == 0u
    || pair.unilateral == 0u
    || !mechanical_matching_constraint_code_valid(constraint)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  let low_velocity = input_state[low_index * 2u + 1u].xyz;
  let high_velocity = input_state[high_index * 2u + 1u].xyz;
  let low_material =
    u32(round(source_thermo[low_index * 3u].x));
  let high_material =
    u32(round(source_thermo[high_index * 3u].x));
  var low_domain = 0u;
  var high_domain = 0u;
  if ((mechanical_params.identity_enabled & 1u) != 0u) {
    low_domain = source_identity[low_index];
    high_domain = source_identity[high_index];
  }
  atomicStore(&mechanical_diagnostic_trace[34u], source_index);
  atomicStore(&mechanical_diagnostic_trace[35u], peer_index);
  atomicStore(&mechanical_diagnostic_trace[36u], low_index);
  atomicStore(&mechanical_diagnostic_trace[37u], high_index);
  atomicStore(&mechanical_diagnostic_trace[38u], reciprocal_cursor);
  atomicStore(
    &mechanical_diagnostic_trace[39u],
    bitcast<u32>(i32(round(constraint.w)))
  );
  mechanical_diagnostic_trace_store_f32(40u, pair.position_residual);
  mechanical_diagnostic_trace_store_f32(41u, pair.velocity_residual);
  mechanical_diagnostic_trace_store_f32(42u, constraint.x);
  mechanical_diagnostic_trace_store_f32(43u, constraint.y);
  mechanical_diagnostic_trace_store_f32(44u, constraint.z);
  mechanical_diagnostic_trace_store_f32(45u, constraint_normal.x);
  mechanical_diagnostic_trace_store_f32(46u, constraint_normal.y);
  mechanical_diagnostic_trace_store_f32(47u, constraint_normal.z);
  atomicStore(&mechanical_diagnostic_trace[48u], low_material);
  atomicStore(&mechanical_diagnostic_trace[49u], high_material);
  atomicStore(
    &mechanical_diagnostic_trace[50u],
    mechanical_solver_phase_class(low_index)
  );
  atomicStore(
    &mechanical_diagnostic_trace[51u],
    mechanical_solver_phase_class(high_index)
  );
  atomicStore(&mechanical_diagnostic_trace[52u], low_domain);
  atomicStore(&mechanical_diagnostic_trace[53u], high_domain);
  mechanical_diagnostic_trace_store_f32(54u, low_pos_mass.w);
  mechanical_diagnostic_trace_store_f32(55u, high_pos_mass.w);
  let relative_velocity = low_velocity - high_velocity;
  mechanical_diagnostic_trace_store_f32(56u, relative_velocity.x);
  mechanical_diagnostic_trace_store_f32(57u, relative_velocity.y);
  mechanical_diagnostic_trace_store_f32(58u, relative_velocity.z);
  mechanical_diagnostic_trace_store_f32(59u, pair.barrier_dv.x);
  mechanical_diagnostic_trace_store_f32(60u, pair.barrier_dv.y);
  mechanical_diagnostic_trace_store_f32(61u, pair.barrier_dv.z);
  if (mechanical_diagnostic_target_tail_header_valid()) {
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let target_a = mechanical_diagnostic_target_index(0u);
    let target_b = mechanical_diagnostic_target_index(1u);
    let target_a_matches =
      target_a == low_index || target_a == high_index;
    let target_b_matches =
      target_b == low_index || target_b == high_index;
    let exact_pair_match =
      target_a_matches
        && target_b_matches
        && target_a != target_b;
    var target_match_bits = 0u;
    if (target_a_matches) {
      target_match_bits = target_match_bits | 1u;
    }
    if (target_b_matches) {
      target_match_bits = target_match_bits | 2u;
    }
    if (exact_pair_match) {
      target_match_bits = target_match_bits | 4u;
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_WINNER_TARGET_MATCH
      );
    }
    atomicStore(
      &mechanical_diagnostic_trace[header + 10u],
      target_match_bits
    );
  }
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_WINNER_MATERIALIZED
  );
}

`;
}

export function createSchroederSpatialMechanicalGraphSolverWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${createSchroederSpatialMechanicalGraphSolverCoreWgsl(solverBudget)}

struct MechanicalMatchingOwnerFrontierCounts {
  active_count: u32,
  contact_count: u32,
  active_cursor_count: u32,
  valid: u32,
};

var<workgroup> mechanical_matching_owner_active_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_contact_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_cursor_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_count_invalid: atomic<u32>;
// Compacted frontier list for the chunked owner: seeded by one validated
// full-particle scan per dispatch, appended at admission transitions inside
// expansion. Capacity mirrors the owner's active-particle cap; a frontier
// larger than the cap fails the pass closed before any phase consumes a
// truncated list.
var<workgroup> mechanical_matching_owner_list:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}>;
var<workgroup> mechanical_matching_owner_list_count: atomic<u32>;
// Double-buffered mover lists for moved-set incremental expansion: the
// apply and wall phases record every particle whose state word they wrote;
// the next logical pass's expansion evaluates only those rows. Overflow or
// a fresh dispatch forces the complete frontier scan instead (fail-safe).
var<workgroup> mechanical_matching_owner_moved_a:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}>;
var<workgroup> mechanical_matching_owner_moved_b:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}>;
var<workgroup> mechanical_matching_owner_moved_count_a: atomic<u32>;
var<workgroup> mechanical_matching_owner_moved_count_b: atomic<u32>;
var<workgroup> mechanical_matching_owner_moved_phase: u32;
var<workgroup> mechanical_matching_owner_moved_prev_valid: u32;
var<workgroup> mechanical_matching_owner_wall_pending_count: atomic<u32>;
// Selection reduction scratch: eight lanes share each contact member's row
// scan (the same lane-group shape as the moved-set expansion), each writing
// its partial candidates here; the group's first lane folds the eight
// partials with the strict total-order merge and runs the per-member
// epilogue. Sized for one candidate record per lane.
var<workgroup> mechanical_matching_selection_scratch:
  array<MechanicalMatchingSelectionScan, 128>;
// Lane-0-written, workgroupUniformLoad-read: the provably uniform member
// count that bounds the barrier-carrying selection wave loop.
var<workgroup> mechanical_matching_owner_selection_member_total: u32;

fn mechanical_matching_owner_record_mover(moved_index: u32) {
  let pending_prior = atomicOr(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + moved_index
    ],
    MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
  );
  if ((pending_prior & MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT) == 0u) {
    atomicAdd(&mechanical_matching_owner_wall_pending_count, 1u);
  }
  if (mechanical_matching_owner_moved_phase == 0u) {
    let slot = atomicAdd(&mechanical_matching_owner_moved_count_a, 1u);
    if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u) {
      mechanical_matching_owner_moved_a[slot] = moved_index;
    }
  } else {
    let slot = atomicAdd(&mechanical_matching_owner_moved_count_b, 1u);
    if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u) {
      mechanical_matching_owner_moved_b[slot] = moved_index;
    }
  }
}

fn mechanical_matching_owner_frontier_counts(
  lane: u32,
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (lane == 0u) {
    atomicStore(&mechanical_matching_owner_active_count, 0u);
    atomicStore(&mechanical_matching_owner_contact_count, 0u);
    atomicStore(&mechanical_matching_owner_cursor_count, 0u);
    atomicStore(&mechanical_matching_owner_count_invalid, 0u);
  }
  workgroupBarrier();
  var local_active_count = 0u;
  var local_contact_count = 0u;
  var local_cursor_count = 0u;
  var local_invalid = 0u;
  if (
    arrayLength(&source_offsets) < mechanical_params.particle_count + 1u
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    local_invalid = 1u;
  } else {
    for (
      var self_index = lane;
      self_index < mechanical_params.particle_count;
      self_index = self_index + 128u
    ) {
      let flags = atomicLoad(
        &matching_cleanup_dispatch[
          MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ]
      );
      let frontier_active =
        (flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u;
      let contact_active =
        (flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u;
      if (
        (flags & ~(MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
          | MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT)) != 0u
        || (contact_active && !frontier_active)
      ) {
        local_invalid = 1u;
        continue;
      }
      if (frontier_active) {
        let begin = source_offsets[self_index];
        let end = source_offsets[self_index + 1u];
        if (begin > end || end > published_total) {
          local_invalid = 1u;
          continue;
        }
        let degree = end - begin;
        if (local_cursor_count > published_total - degree) {
          local_invalid = 1u;
          continue;
        }
        local_active_count = local_active_count + 1u;
        local_cursor_count = local_cursor_count + degree;
      }
      if (contact_active) {
        local_contact_count = local_contact_count + 1u;
      }
    }
  }
  if (local_invalid != 0u) {
    atomicOr(&mechanical_matching_owner_count_invalid, 1u);
  } else {
    atomicAdd(
      &mechanical_matching_owner_active_count,
      local_active_count
    );
    atomicAdd(
      &mechanical_matching_owner_contact_count,
      local_contact_count
    );
    let prior_cursor_count = atomicAdd(
      &mechanical_matching_owner_cursor_count,
      local_cursor_count
    );
    if (prior_cursor_count > published_total - local_cursor_count) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    }
  }
  workgroupBarrier();
  if (atomicLoad(&mechanical_matching_owner_count_invalid) != 0u) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Seed the compacted frontier list for one chunked owner dispatch. This runs
// the exact validation of mechanical_matching_owner_frontier_counts over
// every particle once per dispatch and records each frontier member's index,
// so the order-free per-pass phases (selection/copy/apply/wall/propagate)
// iterate the bounded contact set instead of rescanning every particle. The
// dormant-discovery expansion phase deliberately KEEPS its full particle
// scan: same-pass cascade admission order is part of the deterministic
// logical-pass contract and must not depend on list order.
fn mechanical_matching_owner_seed_frontier(
  lane: u32,
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (lane == 0u) {
    atomicStore(&mechanical_matching_owner_active_count, 0u);
    atomicStore(&mechanical_matching_owner_contact_count, 0u);
    atomicStore(&mechanical_matching_owner_cursor_count, 0u);
    atomicStore(&mechanical_matching_owner_count_invalid, 0u);
    atomicStore(&mechanical_matching_owner_list_count, 0u);
  }
  workgroupBarrier();
  var local_active_count = 0u;
  var local_contact_count = 0u;
  var local_cursor_count = 0u;
  var local_invalid = 0u;
  if (
    arrayLength(&source_offsets) < mechanical_params.particle_count + 1u
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    local_invalid = 1u;
  } else {
    for (
      var self_index = lane;
      self_index < mechanical_params.particle_count;
      self_index = self_index + 128u
    ) {
      let flags = atomicLoad(
        &matching_cleanup_dispatch[
          MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ]
      );
      let frontier_active =
        (flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u;
      let contact_active =
        (flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u;
      if (
        (flags & ~(MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
          | MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT)) != 0u
        || (contact_active && !frontier_active)
      ) {
        local_invalid = 1u;
        continue;
      }
      if (frontier_active) {
        let begin = source_offsets[self_index];
        let end = source_offsets[self_index + 1u];
        if (begin > end || end > published_total) {
          local_invalid = 1u;
          continue;
        }
        let degree = end - begin;
        if (local_cursor_count > published_total - degree) {
          local_invalid = 1u;
          continue;
        }
        local_active_count = local_active_count + 1u;
        local_cursor_count = local_cursor_count + degree;
        let slot = atomicAdd(&mechanical_matching_owner_list_count, 1u);
        if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
          mechanical_matching_owner_list[slot] = self_index;
        }
      }
      if (contact_active) {
        local_contact_count = local_contact_count + 1u;
      }
    }
  }
  if (local_invalid != 0u) {
    atomicOr(&mechanical_matching_owner_count_invalid, 1u);
  } else {
    atomicAdd(
      &mechanical_matching_owner_active_count,
      local_active_count
    );
    atomicAdd(
      &mechanical_matching_owner_contact_count,
      local_contact_count
    );
    let prior_cursor_count = atomicAdd(
      &mechanical_matching_owner_cursor_count,
      local_cursor_count
    );
    if (prior_cursor_count > published_total - local_cursor_count) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    }
  }
  workgroupBarrier();
  if (atomicLoad(&mechanical_matching_owner_count_invalid) != 0u) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Uniform snapshot of the incrementally maintained owner counters. Equals a
// full recount of the flag words because every flag transition passes
// through mechanical_matching_owner_note_admission on the unique lane whose
// atomicOr flipped the bit.
fn mechanical_matching_owner_counter_snapshot(
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (
    atomicLoad(&mechanical_matching_owner_count_invalid) != 0u
    || atomicLoad(&mechanical_matching_owner_cursor_count) > published_total
  ) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Counter/list bookkeeping for one admission transition, called by the lane
// whose atomicOr observed the bit flip (uniqueness comes from the atomic).
fn mechanical_matching_owner_note_admission(
  admitted_index: u32,
  prior_flags: u32,
  published_total: u32
) {
  if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
    let begin = source_offsets[admitted_index];
    let end = source_offsets[admitted_index + 1u];
    if (begin > end || end > published_total) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    } else {
      atomicAdd(&mechanical_matching_owner_active_count, 1u);
      let degree = end - begin;
      let prior_cursor_count = atomicAdd(
        &mechanical_matching_owner_cursor_count,
        degree
      );
      if (prior_cursor_count > published_total - degree) {
        atomicOr(&mechanical_matching_owner_count_invalid, 1u);
      }
      let slot = atomicAdd(&mechanical_matching_owner_list_count, 1u);
      if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
        mechanical_matching_owner_list[slot] = admitted_index;
      }
    }
  }
  if ((prior_flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) == 0u) {
    atomicAdd(&mechanical_matching_owner_contact_count, 1u);
  }
}


// One frontier member's dormant-discovery scan: evaluate every
// not-yet-ever-active cursor of the member's CSR row against live state and
// admit newly active unilateral pairs. Shared by the full-scan and moved-set
// expansion modes so both admit identically for a given evaluation set.
fn mechanical_matching_owner_expand_member(
  self_index: u32,
  published_total: u32
) {
  mechanical_matching_owner_expand_member_strided(
    self_index,
    published_total,
    0u,
    1u
  );
}

// Cursor-strided form: a fixed group of lanes shares one member's row, each
// lane evaluating every cursor_stride-th cursor from its offset. Admissions
// are order-independent (idempotent flag ORs, commutative counter adds, and
// the note_admission transition fires on the unique lane whose atomicOr
// flipped the bit), and every per-pass phase iterates its list order-free,
// so the strided scan admits the identical set with identical effects --
// it only changes which lane performs each evaluation. The moved-set
// incremental loop uses this to spread ~a dozen movers' serial row scans
// (measured ~0.19 ms of the ~0.40 ms logical pass, latency-bound on as
// many lanes as there are movers) across the full workgroup.
fn mechanical_matching_owner_expand_member_strided(
  self_index: u32,
  published_total: u32,
  cursor_offset: u32,
  cursor_stride: u32
) {
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (
    begin > end
    || end > published_total
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
        .CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  for (
    var cursor = begin + cursor_offset;
    cursor < end;
    cursor = cursor + cursor_stride
  ) {
    let encoded_peer = csr_peers[cursor];
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    if (peer_index >= mechanical_params.particle_count) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
    .CSR_BOUNDS_OR_RANK}u
      );
      continue;
    }
    // Known-active constraints are re-evaluated by deterministic row
    // selection below. Expansion owns only dormant discovery, so a
    // steady-state cursor executes the pair law in just one phase; its
    // first active transition is deliberately rechecked by selection.
    if (mechanical_matching_edge_ever_active(encoded_peer)) {
      continue;
    }
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    } else if (pair.active_pair != 0u && pair.unilateral != 0u) {
      csr_peers[cursor] =
        encoded_peer | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
      let contact_flags = MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
        | MECHANICAL_MATCHING_OWNER_CONTACT_BIT;
      let self_prior_flags = atomicOr(
        &matching_cleanup_dispatch[
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ],
        contact_flags
      );
      mechanical_matching_owner_note_admission(
        self_index,
        self_prior_flags,
        published_total
      );
      let peer_prior_flags = atomicOr(
        &matching_cleanup_dispatch[
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
        ],
        contact_flags
      );
      mechanical_matching_owner_note_admission(
        peer_index,
        peer_prior_flags,
        published_total
      );
      // A just-admitted peer may already have passed expansion in this
      // workgroup. Give it one complete selection scan so its reverse
      // cursor is visible in this same logical pass; selection records
      // active cursors and clears this transient flag afterward.
      if (
        (peer_prior_flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) == 0u
      ) {
        atomicOr(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
    ],
    MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
        );
      }
    }
  }
}

@compute @workgroup_size(128)
fn run_matching_cleanup_global_owner(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let lane = local_id.x;
  let owner_word_count =
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
      + mechanical_params.particle_count;
  if (lane == 0u) {
    mechanical_matching_persistent_pass =
      mechanical_matching_current_pass();
    mechanical_matching_persistent_active_count = 0u;
    mechanical_matching_persistent_contact_count = 0u;
    mechanical_matching_persistent_dispatch_active = 0u;
    if (
      mechanical_solver_full_path_enabled()
      && arrayLength(&matching_cleanup_dispatch) < owner_word_count
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    } else if (
      mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&graph_control[14u]) == 0u
    ) {
      mechanical_matching_persistent_dispatch_active = 1u;
    }
  }
  let dispatch_active = workgroupUniformLoad(
    &mechanical_matching_persistent_dispatch_active
  );
  // The host encodes ceil(cleanupPassBudget / ownerPassesPerDispatch)
  // chunked owner quanta for the full logical horizon. Once a prior quantum
  // has synthesized the terminal receipt tail (or failed closed), make every
  // remaining directly encoded quantum a uniform early return instead of
  // executing its otherwise-unavoidable barrier skeleton; the matching
  // in-loop latch below performs the same uniform exit between the logical
  // passes of one quantum. This is entirely GPU-resident and does not add an
  // indirect usage, host observation, or queue fence.
  if (dispatch_active == 0u) {
    if (lane == 0u && arrayLength(&matching_cleanup_dispatch) >= 3u) {
      atomicStore(&matching_cleanup_dispatch[0u], 0u);
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
    }
    return;
  }
  storageBarrier();
  // One validated full-particle frontier scan + list build per dispatch;
  // every later pass reads the incrementally maintained counters and
  // iterates the compacted list in its order-free phases.
  let owner_seed_counts = mechanical_matching_owner_seed_frontier(
    lane,
    atomicLoad(&graph_control[12u])
  );
  if (lane == 0u && owner_seed_counts.valid == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
  }
  workgroupBarrier();
  storageBarrier();

  for (
    var owner_pass = 0u;
    owner_pass
      < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH}u;
    owner_pass = owner_pass + 1u
  ) {
    if (lane == 0u) {
      mechanical_matching_persistent_pass =
        mechanical_matching_current_pass();
      mechanical_matching_persistent_active_count = 0u;
      mechanical_matching_persistent_contact_count = 0u;
      mechanical_matching_persistent_dispatch_active = 0u;
      if (
        mechanical_solver_full_path_enabled()
        && mechanical_matching_persistent_pass
          < ${solverBudget.cleanupPassBudget}u
        && atomicLoad(&graph_control[14u]) == 0u
      ) {
        mechanical_matching_persistent_dispatch_active = 1u;
      }
    }
    // Chunked-pass latch: finalize_matching_cleanup_pass_body advanced the
    // logical pass clock (or synthesized the converged terminal tail, or a
    // stage failed closed) at the end of the previous loop iteration, and
    // this re-check observes it before committing to another logical pass.
    // workgroupUniformLoad both publishes lane 0's writes (it is a control
    // barrier) and returns a workgroup-uniform value, so the break below is
    // uniform across the workgroup and the unconditional barriers of later
    // iterations stay in uniform control flow -- the same pattern as the
    // fresh-dispatch early return above, applied inside the loop.
    let pass_latch_active = workgroupUniformLoad(
      &mechanical_matching_persistent_dispatch_active
    );
    if (pass_latch_active == 0u) {
      break;
    }
    let published_total_before_expansion = atomicLoad(&graph_control[12u]);
    let frontier_counts_before_expansion =
      mechanical_matching_owner_counter_snapshot(
        published_total_before_expansion
      );
    if (lane == 0u) {
      if (frontier_counts_before_expansion.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .CSR_BOUNDS_OR_RANK}u
        );
      } else {
        mechanical_matching_persistent_active_count =
          frontier_counts_before_expansion.active_count;
        mechanical_matching_persistent_contact_count =
          frontier_counts_before_expansion.contact_count;
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD
          ],
          frontier_counts_before_expansion.active_count
        );
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD
          ],
          frontier_counts_before_expansion.active_cursor_count
        );
        if (
          frontier_counts_before_expansion.active_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
          || frontier_counts_before_expansion.active_cursor_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS}u
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .ITERATION_INCOMPLETE}u
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();
    let expand_frontier = mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && arrayLength(&matching_cleanup_dispatch) >= owner_word_count
      && atomicLoad(&graph_control[14u]) == 0u;

    // The frontier is monotone for the complete cleanup. Only a particle that
    // already moved through contact or wall projection can wake a frozen
    // dormant face. Scan those rows before selection and admit both endpoints
    // in the same logical pass. Two unflagged endpoints never move, so their
    // dormant constraint cannot become active behind this frontier.
    // Full-sweep vs incremental pass selection, shared by the expansion and
    // wall phases. Plain reads: these words are written only by lane 0
    // between the pass barriers, so their values are workgroup-uniform here
    // without a control barrier (which would be illegal in conditional
    // flow).
    var owner_moved_prev_count = 0u;
    if (mechanical_matching_owner_moved_phase == 0u) {
      owner_moved_prev_count =
        atomicLoad(&mechanical_matching_owner_moved_count_b);
    } else {
      owner_moved_prev_count =
        atomicLoad(&mechanical_matching_owner_moved_count_a);
    }
    let owner_full_sweep_pass =
      mechanical_matching_owner_moved_prev_valid == 0u
      || owner_moved_prev_count > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u;

    if (expand_frontier) {
      let published_total = atomicLoad(&graph_control[12u]);
      // Moved-set incremental expansion: a dormant pair's activity decision
      // reads only the frozen constraint row and the two endpoints' live
      // input_state, so its outcome is bit-identical until an endpoint's
      // state changes. After the first pass of a chunked dispatch, only the
      // rows of particles recorded as movers by the previous pass's apply
      // and wall phases need re-evaluation; recorder overflow or a fresh
      // dispatch falls back to the complete frontier scan. Same-pass cascade
      // admissions still occur through the mover set exactly when the
      // enabling movement happened, which is the same pass the full scan
      // first evaluates them with changed inputs.
      let moved_prev_count = owner_moved_prev_count;
      if (owner_full_sweep_pass) {
        for (
          var self_index = lane;
          self_index < mechanical_params.particle_count;
          self_index = self_index + 128u
        ) {
          let flags = atomicLoad(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
            ]
          );
          if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
            continue;
          }
          mechanical_matching_owner_expand_member(
            self_index,
            published_total
          );
        }
      } else {
        // Eight lanes share each mover's row, cursor-strided: the typical
        // pass has ~a dozen movers with ~30-cursor rows, so member-per-lane
        // left >100 lanes idle while each busy lane walked its whole row
        // serially (latency-bound, measured ~0.19 ms of the ~0.40 ms pass).
        // The strided scan admits the identical set (see the strided
        // expander's comment); duplicate per-mover flag loads across a
        // group are idempotent reads.
        for (
          var moved_slot = lane / 8u;
          moved_slot < moved_prev_count;
          moved_slot = moved_slot + 16u
        ) {
          var moved_index = 0u;
          if (mechanical_matching_owner_moved_phase == 0u) {
            moved_index = mechanical_matching_owner_moved_b[moved_slot];
          } else {
            moved_index = mechanical_matching_owner_moved_a[moved_slot];
          }
          if (moved_index >= mechanical_params.particle_count) {
            continue;
          }
          let flags = atomicLoad(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + moved_index
            ]
          );
          if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
            continue;
          }
          mechanical_matching_owner_expand_member_strided(
            moved_index,
            published_total,
            lane % 8u,
            8u
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();

    let published_total_after_expansion = atomicLoad(&graph_control[12u]);
    let frontier_counts_after_expansion =
      mechanical_matching_owner_counter_snapshot(
        published_total_after_expansion
      );
    if (lane == 0u && expand_frontier) {
      if (frontier_counts_after_expansion.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .CSR_BOUNDS_OR_RANK}u
        );
      } else if (atomicLoad(&graph_control[14u]) == 0u) {
        mechanical_matching_persistent_active_count =
          frontier_counts_after_expansion.active_count;
        mechanical_matching_persistent_contact_count =
          frontier_counts_after_expansion.contact_count;
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD
          ],
          frontier_counts_after_expansion.active_count
        );
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD
          ],
          frontier_counts_after_expansion.active_cursor_count
        );
        if (
          frontier_counts_after_expansion.active_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
          || frontier_counts_after_expansion.active_cursor_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS}u
          || (
            mechanical_matching_persistent_pass + 16u
              >= ${solverBudget.cleanupPassBudget}u
            && frontier_counts_after_expansion.active_cursor_count
              > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS}u
          )
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .ITERATION_INCOMPLETE}u
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();
    let execute_pass = mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&graph_control[14u]) == 0u;

    if (lane == 0u && execute_pass) {
      atomicStore(
        &traversal_evidence[
          mechanical_matching_selection_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count
          - mechanical_matching_persistent_contact_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_contact_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_matching_persistent_contact_count
      );
      if (
        mechanical_matching_persistent_pass == 0u
        && mechanical_matching_jacobi_residual_converged()
      ) {
        let final_iteration = mechanical_params.solver_iteration_count - 1u;
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_position_ratio_word(0u)
          ],
          atomicLoad(
            &graph_control[
              mechanical_pre_solve_position_violation_ratio_word(
                final_iteration
              )
            ]
          )
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_velocity_residual_word(0u)
          ],
          atomicLoad(
            &graph_control[
              mechanical_pre_solve_velocity_residual_word(final_iteration)
            ]
          )
        );
      }
    }
    storageBarrier();

    // Selection, lane-grouped: eight lanes share each contact member's
    // row (cursor-strided scan into the reduction scratch), then the
    // group's first lane folds the partials and runs the epilogue. The
    // wave loop's trip count comes from a workgroupUniformLoad so its
    // interior barriers sit in provably uniform control flow; per-member
    // work stays gated inside. Winners are scan-order independent (strict
    // total-order predicate), members never read each other's rows,
    // ledger entries, or flags during this phase, and every guard the
    // serial wrapper applies is replicated here, so the grouped phase is
    // value-identical to the member-per-lane loop it replaces.
    if (lane == 0u) {
      mechanical_matching_owner_selection_member_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
    }
    let selection_member_total = workgroupUniformLoad(
      &mechanical_matching_owner_selection_member_total
    );
    let selection_preflight_ok = execute_pass
      && mechanical_matching_preflight(mechanical_matching_persistent_pass);
    let selection_begin_new_sweep =
      mechanical_matching_persistent_pass == 0u
      || mechanical_matching_prior_applied_pair_count(
        mechanical_matching_persistent_pass
      ) == 0u;
    let selection_converged =
      mechanical_matching_persistent_pass == 0u
      && mechanical_matching_jacobi_residual_converged();
    let selection_waves = (selection_member_total + 15u) / 16u;${
      solverBudget.contactInnerRounds > 1
        ? `
    // Inner solver rounds: each logical pass advances ${
            solverBudget.contactInnerRounds
          } violation layers by repeating selection+apply+propagate against
    // the round-updated state, paying the expansion, wall, and evidence
    // phases once per pass. Only the first round counts the per-member
    // completeness words; applied-pair evidence accumulates across
    // rounds so the sweep delimiter reads the pass total. The trip count
    // is a compile-time constant, so the interior barriers stay in
    // uniform control flow.
    for (
      var solver_round = 0u;
      solver_round < ${solverBudget.contactInnerRounds}u;
      solver_round = solver_round + 1u
    ) {
    let round_counts = solver_round == 0u;`
        : ''
    }
    for (
      var selection_wave = 0u;
      selection_wave < selection_waves;
      selection_wave = selection_wave + 1u
    ) {
      let selection_slot = selection_wave * 16u + lane / 8u;
      var selection_member = 0xffffffffu;
      var selection_full = false;
      var selection_scan = mechanical_matching_selection_empty_scan();
      if (
        selection_preflight_ok
        && selection_slot < selection_member_total${
          solverBudget.contactInnerRounds > 1
            ? '\n        && (!selection_converged || solver_round == 0u)'
            : ''
        }
      ) {
        let candidate = mechanical_matching_owner_list[selection_slot];
        if (candidate < mechanical_params.particle_count) {
          let member_flags = atomicLoad(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + candidate
            ]
          );
          if (
            (member_flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u
          ) {
            selection_member = candidate;
            selection_full = (member_flags
              & MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT) != 0u;
            if (!selection_converged) {
              selection_scan = mechanical_matching_selection_scan_range(
                selection_member,
                mechanical_matching_persistent_pass,
                selection_full,
                selection_begin_new_sweep${
                  solverBudget.contactInnerRounds > 1
                    ? ' && solver_round == 0u'
                    : ''
                },
                lane & 7u,
                8u
              );
            }
          }
        }
      }
      mechanical_matching_selection_scratch[lane] = selection_scan;
      workgroupBarrier();
      if ((lane & 7u) == 0u && selection_member != 0xffffffffu) {
        if (selection_converged) {
          let begin = source_offsets[selection_member];
          let end = source_offsets[selection_member + 1u];
          let total = atomicLoad(&graph_control[12u]);
          if (begin > end || end > total) {
            atomicOr(
              &graph_control[14u],
              ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
                .CSR_BOUNDS_OR_RANK}u
            );
          } else {
            mechanical_matching_selection_converged_for_index(
              selection_member,
              mechanical_matching_persistent_pass
            );
          }
        } else {
          var merged = mechanical_matching_selection_scratch[lane];
          for (var fold = 1u; fold < 8u; fold = fold + 1u) {
            merged = mechanical_matching_selection_merge(
              merged,
              mechanical_matching_selection_scratch[lane + fold]
            );
          }
          if (merged.row_max_velocity_residual_m_per_s >= 0.0) {
            mechanical_matching_selection_epilogue(
              selection_member,
              mechanical_matching_persistent_pass,
              selection_full,
              ${
                solverBudget.contactInnerRounds > 1
                  ? 'round_counts'
                  : 'true'
              },
              merged
            );
          }
        }
      }
      workgroupBarrier();
    }
    storageBarrier();

    if (lane == 0u && execute_pass${
      solverBudget.contactInnerRounds > 1 ? ' && round_counts' : ''
    }) {
      // Pass 0 must re-baseline output from the Jacobi-final input (the
      // solver iterations ping-pong the buffers before cleanup). From pass 1
      // on, the propagate phase leaves input_state == output_state for every
      // frontier member at each pass end, so the re-baseline is a
      // value-identical no-op: store the completeness proof directly and
      // skip the traversal. The standalone per-pass pipeline path keeps the
      // explicit copy dispatch on every pass.
      var copy_workset_count = 0u;
      if (mechanical_matching_persistent_pass == 0u) {
        copy_workset_count = mechanical_matching_persistent_active_count;
      }
      atomicStore(
        &traversal_evidence[
          mechanical_matching_copy_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count - copy_workset_count
      );
    }
    storageBarrier();

    if (
      execute_pass
      && mechanical_matching_persistent_pass == 0u${
        solverBudget.contactInnerRounds > 1
          ? '\n      && round_counts'
          : ''
      }
    ) {
      let owner_list_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
      for (
        var list_slot = lane;
        list_slot < owner_list_total;
        list_slot = list_slot + 128u
      ) {
        let self_index = mechanical_matching_owner_list[list_slot];
        let flags = atomicLoad(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ]
        );
        if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
          copy_matching_cleanup_state_for_index(self_index);
        }
      }
    }
    storageBarrier();

    storageBarrier();

    if (lane == 0u && execute_pass${
      solverBudget.contactInnerRounds > 1 ? ' && round_counts' : ''
    }) {
      atomicStore(
        &traversal_evidence[
          mechanical_matching_apply_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count
          - mechanical_matching_persistent_contact_count
      );
    }
    storageBarrier();

    if (execute_pass) {
      let owner_list_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
      for (
        var list_slot = lane;
        list_slot < owner_list_total;
        list_slot = list_slot + 128u
      ) {
        let self_index = mechanical_matching_owner_list[list_slot];
        let flags = atomicLoad(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ]
        );
        if ((flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u) {
          apply_matching_cleanup_edge_for_index(
            self_index,
            ${
              solverBudget.contactInnerRounds > 1
                ? 'round_counts'
                : 'true'
            }
          );
        }
      }
    }
    storageBarrier();${
      solverBudget.contactInnerRounds > 1
        ? `
    // Inner propagate: publish this round's outputs as the next round's
    // inputs for every member recorded as a mover this pass (idempotent
    // for earlier rounds' movers), then start the next round.
    if (execute_pass) {
      var inner_propagate_total = 0u;
      if (mechanical_matching_owner_moved_phase == 0u) {
        inner_propagate_total =
          atomicLoad(&mechanical_matching_owner_moved_count_a);
      } else {
        inner_propagate_total =
          atomicLoad(&mechanical_matching_owner_moved_count_b);
      }
      inner_propagate_total = min(
        inner_propagate_total,
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u
      );
      for (
        var inner_slot = lane;
        inner_slot < inner_propagate_total;
        inner_slot = inner_slot + 128u
      ) {
        var inner_index = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          inner_index = mechanical_matching_owner_moved_a[inner_slot];
        } else {
          inner_index = mechanical_matching_owner_moved_b[inner_slot];
        }
        if (inner_index >= mechanical_params.particle_count) {
          continue;
        }
        input_state[inner_index * 2u] = output_state[inner_index * 2u];
        input_state[inner_index * 2u + 1u] =
          output_state[inner_index * 2u + 1u];
      }
    }
    storageBarrier();
    }`
        : ''
    }

    // Snapshot for the full-sweep pending-counter rebase below. The
    // workgroup counter zero-initializes each chunked dispatch while
    // WALL_PENDING bits persist in storage, so a full sweep claims bits
    // this dispatch never counted; per-claim decrements would wrap the
    // counter below zero. Instead the sweep leaves the counter alone and
    // lane 0 subtracts this pre-sweep snapshot afterwards: a fixed-amount
    // subtract commutes with the sweep's own concurrent record_mover
    // increments, leaving exactly the freshly recorded pending count.
    var owner_wall_pending_rebase = 0u;
    if (lane == 0u && execute_pass) {
      // Full-sweep passes wall-project every frontier member (completeness
      // complement = N - frontier). Incremental passes project exactly the
      // wall-pending claims (complement = N - pending): a member's wall
      // outcome is a pure function of its own output state, so a member
      // whose state did not change since its last projection re-derives
      // bit-identical writes and is exactly skippable.
      var wall_workset_count = mechanical_matching_persistent_active_count;
      if (!owner_full_sweep_pass) {
        wall_workset_count =
          atomicLoad(&mechanical_matching_owner_wall_pending_count);
      } else {
        owner_wall_pending_rebase =
          atomicLoad(&mechanical_matching_owner_wall_pending_count);
      }
      atomicStore(
        &traversal_evidence[
          mechanical_matching_wall_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count - wall_workset_count
      );
    }
    storageBarrier();

    if (execute_pass) {
      if (owner_full_sweep_pass) {
        let owner_list_total = min(
          atomicLoad(&mechanical_matching_owner_list_count),
          ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
        );
        for (
          var list_slot = lane;
          list_slot < owner_list_total;
          list_slot = list_slot + 128u
        ) {
          let self_index = mechanical_matching_owner_list[list_slot];
          // Claim (clear) the pending bit but do NOT decrement the counter
          // per claim: bits set by the previous dispatch were never counted
          // by this dispatch's zero-initialized workgroup counter, and a
          // per-claim decrement wraps it. Lane 0 rebases the counter by the
          // pre-sweep snapshot after this loop instead.
          let prior_flags = atomicAnd(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
            ],
            ~MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          );
          if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
            project_matching_cleanup_walls_for_index(self_index);
          }
        }
      } else {
        // Incremental wall: exactly the pending claims. Every pending member
        // is present in the previous or current mover list (record_mover
        // appends where it sets the bit; a fresh dispatch full-sweeps), and
        // the atomicAnd claim admits each member once even when it appears
        // in both lists.
        var wall_prev_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          wall_prev_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        } else {
          wall_prev_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        }
        wall_prev_total = min(wall_prev_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u);
        var wall_cur_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          wall_cur_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        } else {
          wall_cur_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        }
        wall_cur_total = min(wall_cur_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u);
        for (
          var wall_slot = lane;
          wall_slot < wall_prev_total + wall_cur_total;
          wall_slot = wall_slot + 128u
        ) {
          var wall_index = 0u;
          if (wall_slot < wall_prev_total) {
            if (mechanical_matching_owner_moved_phase == 0u) {
              wall_index = mechanical_matching_owner_moved_b[wall_slot];
            } else {
              wall_index = mechanical_matching_owner_moved_a[wall_slot];
            }
          } else {
            let cur_slot = wall_slot - wall_prev_total;
            if (mechanical_matching_owner_moved_phase == 0u) {
              wall_index = mechanical_matching_owner_moved_a[cur_slot];
            } else {
              wall_index = mechanical_matching_owner_moved_b[cur_slot];
            }
          }
          if (wall_index >= mechanical_params.particle_count) {
            continue;
          }
          let prior_flags = atomicAnd(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + wall_index
            ],
            ~MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          );
          if (
            (prior_flags & MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT) == 0u
          ) {
            continue;
          }
          atomicSub(&mechanical_matching_owner_wall_pending_count, 1u);
          if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
            project_matching_cleanup_walls_for_index(wall_index);
          }
        }
      }
    }
    storageBarrier();

    if (execute_pass) {
      if (owner_full_sweep_pass) {
        let owner_list_total = min(
          atomicLoad(&mechanical_matching_owner_list_count),
          ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
        );
        for (
          var list_slot = lane;
          list_slot < owner_list_total;
          list_slot = list_slot + 128u
        ) {
          let self_index = mechanical_matching_owner_list[list_slot];
          input_state[self_index * 2u] = output_state[self_index * 2u];
          input_state[self_index * 2u + 1u] =
            output_state[self_index * 2u + 1u];
        }
      } else {
        // Only members whose output changed this pass (apply members plus
        // wall changes, i.e. exactly the current mover list) need the
        // output -> input propagate; everyone else is already equal.
        // Duplicate entries are harmless value-identical copies.
        var propagate_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          propagate_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        } else {
          propagate_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        }
        propagate_total = min(propagate_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY}u);
        for (
          var propagate_slot = lane;
          propagate_slot < propagate_total;
          propagate_slot = propagate_slot + 128u
        ) {
          var propagate_index = 0u;
          if (mechanical_matching_owner_moved_phase == 0u) {
            propagate_index =
              mechanical_matching_owner_moved_a[propagate_slot];
          } else {
            propagate_index =
              mechanical_matching_owner_moved_b[propagate_slot];
          }
          if (propagate_index >= mechanical_params.particle_count) {
            continue;
          }
          input_state[propagate_index * 2u] =
            output_state[propagate_index * 2u];
          input_state[propagate_index * 2u + 1u] =
            output_state[propagate_index * 2u + 1u];
        }
      }
    }
    storageBarrier();

    if (lane == 0u && execute_pass) {
      finalize_matching_cleanup_pass_body();
    }
    storageBarrier();
    // Rotate the mover buffers: this pass's recorded movers become the next
    // pass's expansion set, and the buffer that will collect next pass is
    // cleared. Zero-initialized workgroup state makes the first pass of a
    // fresh dispatch fall back to the complete frontier scan.
    if (lane == 0u && execute_pass) {
      if (owner_full_sweep_pass) {
        // Rebase the pending counter: the full sweep claimed every set
        // WALL_PENDING bit without touching the counter, so subtracting
        // the pre-sweep snapshot leaves exactly the count of bits the
        // sweep's own wall projections freshly recorded. The fixed-amount
        // subtract commutes with those concurrent increments.
        atomicSub(
          &mechanical_matching_owner_wall_pending_count,
          owner_wall_pending_rebase
        );
      }
      mechanical_matching_owner_moved_prev_valid = 1u;
      if (mechanical_matching_owner_moved_phase == 0u) {
        mechanical_matching_owner_moved_phase = 1u;
        atomicStore(&mechanical_matching_owner_moved_count_b, 0u);
      } else {
        mechanical_matching_owner_moved_phase = 0u;
        atomicStore(&mechanical_matching_owner_moved_count_a, 0u);
      }
    }
    workgroupBarrier();
  }
  if (lane == 0u && arrayLength(&matching_cleanup_dispatch) >= 3u) {
    atomicStore(
      &matching_cleanup_dispatch[0u],
      select(
        0u,
        1u,
        mechanical_solver_full_path_enabled()
          && mechanical_matching_current_pass()
            < ${solverBudget.cleanupPassBudget}u
          && atomicLoad(&graph_control[14u]) == 0u
      )
    );
  }
}

// Multi-workgroup parallel Jacobi cleanup operating directly on the frozen
// finite-volume matching_constraints halfspaces across all GPU SMs. Preserves
// exact pairwise momentum conservation, Gershgorin kinetic-energy dissipation
// bounds, exact heat closure in energy_ledger, wall projection, and early-exit
// terminal synthesis when residuals converge within tolerance.
@compute @workgroup_size(64)
fn parallel_jacobi_cleanup_measure(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (
    !mechanical_solver_full_path_enabled()
    || arrayLength(&matching_cleanup_dispatch)
      < MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
        + mechanical_params.particle_count
    || atomicLoad(&matching_cleanup_dispatch[0u]) == 0u
    || atomicLoad(&graph_control[14u]) != 0u
  ) { return; }
  let invalid_index = 0xffffffffu;
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(invalid_index),
    0.0,
    bitcast<f32>(invalid_index),
    bitcast<f32>(invalid_index)
  );
  let self_pos_mass = input_state[self_index * 2u];
  let self_vel_u = input_state[self_index * 2u + 1u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  if (!(self_pos_mass.w > 0.0) || !(self_volume > 0.0)) {
    particle_scales[self_index] = vec4<f32>(
      1.0,
      1.0,
      particle_scales[self_index].z,
      particle_scales[self_index].w
    );
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total || total > arrayLength(&matching_constraints)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var barrier_dx_triangle_sum_m = 0.0;
  var position_dx_sum_m = vec3<f32>(0.0);
  var position_max_pair_dx_m = 0.0;
  var velocity_tensor_00 = 0.0;
  var velocity_tensor_01 = 0.0;
  var velocity_tensor_02 = 0.0;
  var velocity_tensor_11 = 0.0;
  var velocity_tensor_12 = 0.0;
  var velocity_tensor_22 = 0.0;
  var max_position_violation_ratio = 0.0;
  var max_velocity_residual_m_per_s = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    let preserved_bits = encoded_peer
      & (MECHANICAL_SOLVER_EDGE_PEER_MASK
        | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT);
    if (all(matching_constraints[cursor] == vec4<f32>(0.0))) {
      csr_peers[cursor] = preserved_bits | MECHANICAL_SOLVER_EDGE_INACTIVE_BIT;
      continue;
    }
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let fixed_pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (fixed_pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let edge_active = fixed_pair.active_pair != 0u
      && fixed_pair.unilateral != 0u;
    csr_peers[cursor] = preserved_bits | select(
      MECHANICAL_SOLVER_EDGE_INACTIVE_BIT,
      0u,
      edge_active
    );
    if (!edge_active) {
      continue;
    }
    let position_tolerance_m = mechanical_matching_position_tolerance(
      low_index,
      high_index
    );
    max_position_violation_ratio = max(
      max_position_violation_ratio,
      fixed_pair.position_residual / position_tolerance_m
    );
    max_velocity_residual_m_per_s = max(
      max_velocity_residual_m_per_s,
      fixed_pair.velocity_residual
    );
    let low_mass = input_state[low_index * 2u].w;
    let other_mass = input_state[peer_index * 2u].w;
    if (!(low_mass > 0.0) || !(other_mass > 0.0)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let self_barrier_dx = select(
      -(low_mass / self_pos_mass.w) * fixed_pair.barrier_dx,
      fixed_pair.barrier_dx,
      self_index == low_index
    );
    let dx_len = length(self_barrier_dx);
    barrier_dx_triangle_sum_m = barrier_dx_triangle_sum_m + dx_len;
    position_dx_sum_m = position_dx_sum_m + self_barrier_dx;
    position_max_pair_dx_m = max(position_max_pair_dx_m, dx_len);
    if (dot(fixed_pair.velocity_normal, fixed_pair.velocity_normal) > 0.5) {
      let self_inv_mass = 1.0 / max(self_pos_mass.w, 1.0e-30);
      let other_inv_mass = 1.0 / max(other_mass, 1.0e-30);
      let inv_share = self_inv_mass / (self_inv_mass + other_inv_mass);
      let dir = fixed_pair.velocity_normal;
      velocity_tensor_00 = velocity_tensor_00 + inv_share * dir.x * dir.x;
      velocity_tensor_01 = velocity_tensor_01 + inv_share * dir.x * dir.y;
      velocity_tensor_02 = velocity_tensor_02 + inv_share * dir.x * dir.z;
      velocity_tensor_11 = velocity_tensor_11 + inv_share * dir.y * dir.y;
      velocity_tensor_12 = velocity_tensor_12 + inv_share * dir.y * dir.z;
      velocity_tensor_22 = velocity_tensor_22 + inv_share * dir.z * dir.z;
    }
  }
  let self_diameter_m = mechanical_solver_cbrt(self_volume);
  let epoch_pos = mechanical_solver_epoch_position(self_index);
  let initial_displacement_m = length(self_pos_mass.xyz - epoch_pos);
  let current_wall_projection_m =
    mechanical_solver_wall_projection_bound_for_diameter(
      self_index,
      self_diameter_m
    );
  let wall_velocity_check = mechanical_matching_project_wall_velocity(
    self_index,
    self_pos_mass.xyz,
    self_vel_u.xyz,
    self_pos_mass.w
  );
  if (
    current_wall_projection_m > 1.0e-5
    || wall_velocity_check.clipped != 0u
  ) {
    max_position_violation_ratio = max(max_position_violation_ratio, 2.0);
  }
  let position_trust_capacity_m = particle_scales[self_index].z;
  let remaining_position_trust_m = max(
    0.0,
    position_trust_capacity_m
      - initial_displacement_m
      - current_wall_projection_m
  );
  let position_sum_length_m = length(position_dx_sum_m);
  let position_degree_scale = select(
    1.0,
    min(
      1.0,
      position_max_pair_dx_m / max(position_sum_length_m, 1.0e-30)
    ),
    position_sum_length_m > 1.0e-12
  );
  let position_trust_scale = select(
    position_degree_scale,
    min(
      position_degree_scale,
      remaining_position_trust_m / max(barrier_dx_triangle_sum_m, 1.0e-30)
    ),
    barrier_dx_triangle_sum_m > 1.0e-12
  );
  let velocity_operator_bound =
    velocity_tensor_00 + velocity_tensor_11 + velocity_tensor_22;
  let velocity_stability_scale = 1.0 / max(
    ${SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR}.0
      * velocity_operator_bound,
    1.0
  );
  if (
    !mechanical_solver_finite(position_trust_scale)
    || !mechanical_solver_finite(velocity_stability_scale)
    || !mechanical_solver_finite(max_position_violation_ratio)
    || !mechanical_solver_finite(max_velocity_residual_m_per_s)
    || position_trust_scale < 0.0
    || position_trust_scale > 1.0
    || velocity_stability_scale < 0.0
    || velocity_stability_scale > 1.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  particle_scales[self_index] = vec4<f32>(
    position_trust_scale,
    velocity_stability_scale,
    position_trust_capacity_m,
    remaining_position_trust_m
  );
  atomicMax(
    &matching_cleanup_dispatch[3u],
    bitcast<u32>(max(max_position_violation_ratio, 0.0))
  );
  atomicMax(
    &matching_cleanup_dispatch[4u],
    bitcast<u32>(max(max_velocity_residual_m_per_s, 0.0))
  );
}

@compute @workgroup_size(1)
fn parallel_jacobi_cleanup_check_converged() {
  if (
    !mechanical_solver_full_path_enabled()
    || arrayLength(&matching_cleanup_dispatch) < 5u
    || atomicLoad(&matching_cleanup_dispatch[0u]) == 0u
    || atomicLoad(&graph_control[14u]) != 0u
  ) { return; }
  let max_pos_ratio_bits = atomicLoad(&matching_cleanup_dispatch[3u]);
  let max_vel_res_bits = atomicLoad(&matching_cleanup_dispatch[4u]);
  atomicStore(&matching_cleanup_dispatch[3u], 0u);
  atomicStore(&matching_cleanup_dispatch[4u], 0u);
  let max_pos_ratio = bitcast<f32>(max_pos_ratio_bits);
  let max_vel_res = bitcast<f32>(max_vel_res_bits);
  if (
    mechanical_solver_finite(max_pos_ratio)
    && mechanical_solver_finite(max_vel_res)
    && max_pos_ratio <= 1.0
    && max_vel_res <= 1.0e-6
  ) {
    for (
      var completed_pass = 0u;
      completed_pass < ${solverBudget.cleanupPassBudget}u;
      completed_pass = completed_pass + 1u
    ) {
      atomicStore(
        &traversal_evidence[
          mechanical_matching_selection_count_word(completed_pass)
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_copy_count_word(completed_pass)
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_apply_count_word(completed_pass)
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_wall_count_word(completed_pass)
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_applied_pair_count_word(completed_pass)
        ],
        0u
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_max_position_ratio_word(completed_pass)
        ],
        max_pos_ratio_bits
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_max_velocity_residual_word(completed_pass)
        ],
        max_vel_res_bits
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_contact_count_word(completed_pass)
        ],
        0u
      );
    }
    atomicStore(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u],
      ${solverBudget.cleanupPassBudget}u
    );
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    );
    atomicStore(&matching_cleanup_dispatch[0u], 0u);
    atomicStore(&matching_cleanup_dispatch[1u], 1u);
    atomicStore(&matching_cleanup_dispatch[2u], 1u);
  }
}

@compute @workgroup_size(64)
fn parallel_jacobi_cleanup_solve(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (
    !mechanical_solver_full_path_enabled()
    || arrayLength(&matching_cleanup_dispatch)
      < MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
        + mechanical_params.particle_count
    || atomicLoad(&matching_cleanup_dispatch[0u]) == 0u
    || atomicLoad(&graph_control[14u]) != 0u
  ) { return; }
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let energy_base = mechanical_energy_base(self_index);
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  if (!(pos_mass.w > 0.0) || !(self_volume > 0.0)) {
    energy_ledger[energy_base] = vec4<f32>(0.0);
    output_state[self_index * 2u] = pos_mass;
    output_state[self_index * 2u + 1u] = vel_u;
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total || total > arrayLength(&matching_constraints)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var dx = vec3<f32>(0.0);
  var dv = vec3<f32>(0.0);
  var half_linear_loss_budget_j = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let fixed_pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (fixed_pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (fixed_pair.active_pair == 0u || fixed_pair.unilateral == 0u) {
      continue;
    }
    let pair_scale = mechanical_solver_pair_scale(self_index, peer_index);
    let low_mass = input_state[low_index * 2u].w;
    let high_mass = input_state[high_index * 2u].w;
    if (!(low_mass > 0.0) || !(high_mass > 0.0)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let low_pair_dv = pair_scale.y * fixed_pair.barrier_dv;
    let high_pair_dv = -(low_mass / high_mass) * low_pair_dv;
    let self_pair_dv = select(high_pair_dv, low_pair_dv, self_index == low_index);
    let low_pair_dx = pair_scale.x * fixed_pair.barrier_dx;
    let high_pair_dx = -(low_mass / high_mass) * low_pair_dx;
    let self_pair_dx = select(high_pair_dx, low_pair_dx, self_index == low_index);
    if (
      !mechanical_solver_finite3(low_pair_dv)
      || !mechanical_solver_finite3(high_pair_dv)
      || !mechanical_solver_finite3(self_pair_dx)
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let edge = mechanical_edge_linear_loss_from_pair_dv(
      low_index,
      high_index,
      low_pair_dv,
      high_pair_dv
    );
    if (edge.valid == 0u) { return; }
    half_linear_loss_budget_j = half_linear_loss_budget_j + 0.5 * edge.loss_j;
    dx = dx + self_pair_dx;
    dv = dv + self_pair_dv;
  }
  var position = pos_mass.xyz + dx;
  let contact_velocity = vel_u.xyz + dv;
  var velocity = contact_velocity;
  let self_diameter_m = mechanical_solver_cbrt(self_volume);
  var wall_clearance = 0.0;
  if (self_diameter_m > 0.0) {
    wall_clearance = 0.5 * self_diameter_m;
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(wall_clearance, 0.5 * mechanical_params.grid_spacing_m);
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let upper = max(
    vec3<f32>(wall_clearance),
    mechanical_params.box_dims_m - vec3<f32>(wall_clearance)
  );
  let lower = vec3<f32>(wall_clearance);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (position.x < wall_clearance) {
    position.x = wall_clearance;
  } else if (position.x > upper.x) {
    position.x = upper.x;
  }
  if (position.y < wall_clearance) {
    position.y = wall_clearance;
  } else if (position.y > upper.y) {
    position.y = upper.y;
  }
  if (position.z < wall_clearance) {
    position.z = wall_clearance;
  } else if (position.z > upper.z) {
    position.z = upper.z;
  }
  if (position.x <= lower.x + lower_tolerance_m.x && velocity.x < 0.0) {
    velocity.x = 0.0;
  }
  if (position.x >= upper.x - upper_tolerance_m.x && velocity.x > 0.0) {
    velocity.x = 0.0;
  }
  if (position.y <= lower.y + lower_tolerance_m.y && velocity.y < 0.0) {
    velocity.y = 0.0;
  }
  if (position.y >= upper.y - upper_tolerance_m.y && velocity.y > 0.0) {
    velocity.y = 0.0;
  }
  if (position.z <= lower.z + lower_tolerance_m.z && velocity.z < 0.0) {
    velocity.z = 0.0;
  }
  if (position.z >= upper.z - upper_tolerance_m.z && velocity.z > 0.0) {
    velocity.z = 0.0;
  }
  if (!mechanical_solver_finite3(position) || !mechanical_solver_finite3(velocity)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(contact_velocity, contact_velocity)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(contact_velocity, contact_velocity)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || wall_kinetic_delta_j > wall_tolerance_j
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    return;
  }
  let quadratic_energy_j = 0.5 * max(pos_mass.w, 0.0) * dot(dv, dv);
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let budget_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(
      quadratic_energy_j + half_linear_loss_budget_j,
      1.0
    )
  );
  if (
    !mechanical_solver_finite(quadratic_energy_j)
    || !mechanical_solver_finite(half_linear_loss_budget_j)
    || !mechanical_solver_finite(wall_heat_j)
    || quadratic_energy_j > half_linear_loss_budget_j + budget_tolerance_j
    || wall_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(quadratic_energy_j)
          && mechanical_solver_finite(half_linear_loss_budget_j)
          && quadratic_energy_j > half_linear_loss_budget_j + budget_tolerance_j
      )
    );
    return;
  }
  let quadratic_budget_fraction = select(
    0.0,
    clamp(
      quadratic_energy_j / max(half_linear_loss_budget_j, 1.0e-30),
      0.0,
      1.0
    ),
    half_linear_loss_budget_j > 0.0
  );
  energy_ledger[energy_base] = vec4<f32>(
    quadratic_budget_fraction,
    quadratic_energy_j,
    half_linear_loss_budget_j,
    wall_heat_j
  );
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
  if (dot(dx, dx) > 0.0 || dot(dv, dv) > 0.0 || wall_heat_j > 0.0) {
    atomicOr(
      &matching_cleanup_dispatch[
        MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
      ],
      MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
    );
  }
}

@compute @workgroup_size(64)
fn parallel_jacobi_cleanup_allocate_energy(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (
    !mechanical_solver_full_path_enabled()
    || arrayLength(&matching_cleanup_dispatch)
      < MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
        + mechanical_params.particle_count
    || atomicLoad(&matching_cleanup_dispatch[0u]) == 0u
    || atomicLoad(&graph_control[14u]) != 0u
  ) { return; }
  if (self_index == 0u) {
    atomicStore(&matching_cleanup_dispatch[3u], 0u);
    atomicStore(&matching_cleanup_dispatch[4u], 0u);
  }
  let energy_base = mechanical_energy_base(self_index);
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let budget = energy_ledger[energy_base];
  var cumulative = energy_ledger[energy_base + 1u];
  var linear_loss_share_j = 0.0;
  var pair_heat_j = 0.0;
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  if (pos_mass.w > 0.0 && self_volume > 0.0) {
    let begin = source_offsets[self_index];
    let end = source_offsets[self_index + 1u];
    let total = atomicLoad(&graph_control[12u]);
    if (begin > end || end > total || total > arrayLength(&matching_constraints)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      return;
    }
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      let encoded_peer = csr_peers[cursor];
      if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
      let peer_index = mechanical_solver_peer_index(encoded_peer);
      let low_index = min(self_index, peer_index);
      let high_index = max(self_index, peer_index);
      let fixed_pair = mechanical_matching_constraint_pair(
        low_index,
        high_index,
        cursor
      );
      if (fixed_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (fixed_pair.active_pair == 0u || fixed_pair.unilateral == 0u) {
        continue;
      }
      let pair_scale = mechanical_solver_pair_scale(self_index, peer_index);
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let low_pair_dv = pair_scale.y * fixed_pair.barrier_dv;
      let high_pair_dv = -(low_pos_mass.w / high_pos_mass.w) * low_pair_dv;
      let edge = mechanical_edge_linear_loss_from_pair_dv(
        low_index,
        high_index,
        low_pair_dv,
        high_pair_dv
      );
      if (edge.valid == 0u) { return; }
      let edge_heat_fraction = max(
        0.0,
        1.0 - 0.5 * (
          energy_ledger[mechanical_energy_base(low_index)].x
            + energy_ledger[mechanical_energy_base(high_index)].x
        )
      );
      let edge_heat_j = edge.loss_j * edge_heat_fraction;
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = select(
        0.5,
        low_pos_mass.w / pair_mass,
        pair_mass > 0.0
      );
      let self_mass_fraction = select(
        1.0 - low_mass_fraction,
        low_mass_fraction,
        self_index == low_index
      );
      linear_loss_share_j = linear_loss_share_j + edge.loss_j * self_mass_fraction;
      pair_heat_j = pair_heat_j + edge_heat_j * self_mass_fraction;
    }
  }
  let pair_delta_k_j = budget.y - linear_loss_share_j;
  let wall_heat_j = budget.w;
  let cumulative_heat_j = cumulative.y + cumulative.z + pair_heat_j + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w + cumulative_heat_j / pos_mass.w,
    pos_mass.w > 0.0
  );
  let start_u = select(vel_u.w, cumulative.w, pos_mass.w > 0.0);
  if (
    !mechanical_solver_finite(pair_delta_k_j)
    || !mechanical_solver_finite(pair_heat_j)
    || !mechanical_solver_finite(wall_heat_j)
    || !mechanical_solver_finite(next_u)
    || pair_heat_j < 0.0
    || wall_heat_j < 0.0
    || next_u < start_u
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NEGATIVE_INTERNAL_ENERGY}u,
        mechanical_solver_finite(next_u) && next_u < start_u
      )
    );
    return;
  }
  let committed_velocity = output_state[self_index * 2u + 1u];
  output_state[self_index * 2u + 1u] = vec4<f32>(committed_velocity.xyz, next_u);
  energy_ledger[energy_base + 1u] = vec4<f32>(
    cumulative.x + pair_delta_k_j,
    cumulative.y + pair_heat_j,
    cumulative.z + wall_heat_j,
    cumulative.w
  );
  let position_trust_capacity_m = particle_scales[self_index].z;
  let next_epoch_displacement_m = length(
    output_state[self_index * 2u].xyz - mechanical_solver_epoch_position(self_index)
  );
  particle_scales[self_index].w = max(
    0.0,
    position_trust_capacity_m - next_epoch_displacement_m
  );
}
`;
}

export function createSchroederSpatialMechanicalInterfaceReceiptWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> final_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read> csr_peers: array<u32>;
@group(0) @binding(5) var<storage, read> source_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> graph_control:
  array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> interface_receipt:
  array<atomic<u32>>;
@group(0) @binding(8) var<uniform> mechanical_params:
  MechanicalProposalParams;
@group(0) @binding(9) var<storage, read> spatial_source_rows:
  array<f32>;

const INTERFACE_RECEIPT_HEADER_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS}u;
const INTERFACE_RECEIPT_ROW_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS}u;
const INTERFACE_RECEIPT_STATUS_BUILDING: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING}u;
const INTERFACE_RECEIPT_STATUS_READY: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY}u;
const INTERFACE_RECEIPT_STATUS_ADMITTED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED}u;
const INTERFACE_RECEIPT_STATUS_FAIL_CLOSED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED}u;
const INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK}u;
const INTERFACE_RECEIPT_INDEX_ALGORITHM: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_SOURCE_LOCAL_LINEAR_PROBE}u;
const INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD}u;
const INTERFACE_RECEIPT_INDEX_BASE_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_BASE_WORD}u;
const INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD}u;
const INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD}u;
const INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD}u;
const INTERFACE_RECEIPT_INDEX_STATUS_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_WORD}u;
const INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW}u;
const INTERFACE_RECEIPT_INDEX_EMPTY: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_EMPTY >>> 0}u;
const INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER >>> 0}u;
const INTERFACE_RECEIPT_INDEX_STATUS_BUILDING: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_BUILDING}u;
const INTERFACE_RECEIPT_INDEX_STATUS_READY: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_READY}u;
const INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED}u;
const INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED}u;

fn interface_receipt_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn interface_receipt_invalid_value() -> f32 {
  // Keep the payload runtime-derived so WGSL implementations do not reject a
  // constant NaN during shader validation. Either infinity (zero payload) or
  // NaN (nonzero payload) is rejected by interface_receipt_finite.
  return bitcast<f32>(mechanical_params.generation_id | 0x7f800000u);
}

fn interface_receipt_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

struct InterfaceReceiptFace {
  area_m2: f32,
  normal_axis: u32,
  admitted: u32,
};

fn interface_receipt_interval_overlap_m(
  delta_m: f32,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  return max(
    0.0,
    min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m)
    )
  );
}

fn interface_receipt_tangent_zero_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  return 16.0 * 1.1920929e-7 * geometric_scale_m;
}

fn interface_receipt_face_at_delta(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32,
  normal_tolerance_m: f32
) -> InterfaceReceiptFace {
  let rejected = InterfaceReceiptFace(0.0, 0u, 0u);
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let separation_m = abs(delta_m) - vec3<f32>(half_sum_m);
  var normal_axis = 0u;
  var normal_separation_m = separation_m.x;
  if (separation_m.y > normal_separation_m) {
    normal_axis = 1u;
    normal_separation_m = separation_m.y;
  }
  if (separation_m.z > normal_separation_m) {
    normal_axis = 2u;
    normal_separation_m = separation_m.z;
  }
  if (normal_separation_m > normal_tolerance_m) { return rejected; }
  var overlap_a_m = 0.0;
  var overlap_b_m = 0.0;
  if (normal_axis == 0u) {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.y,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.z,
      self_edge_m,
      other_edge_m
    );
  } else if (normal_axis == 1u) {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.x,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.z,
      self_edge_m,
      other_edge_m
    );
  } else {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.x,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.y,
      self_edge_m,
      other_edge_m
    );
  }
  let tangent_zero_tolerance_m =
    interface_receipt_tangent_zero_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  if (
    overlap_a_m <= tangent_zero_tolerance_m
    || overlap_b_m <= tangent_zero_tolerance_m
  ) { return rejected; }
  let area_m2 = overlap_a_m * overlap_b_m;
  if (!interface_receipt_finite(area_m2) || area_m2 <= 0.0) {
    return rejected;
  }
  return InterfaceReceiptFace(area_m2, normal_axis, 1u);
}

fn interface_receipt_swept_axis_interval(
  start_m: f32,
  sweep_m: f32,
  half_sum_m: f32
) -> vec3<f32> {
  if (abs(sweep_m) <= 1.0e-12) {
    if (abs(start_m) > half_sum_m) { return vec3<f32>(0.0); }
    return vec3<f32>(-3.402823e+38, 3.402823e+38, 1.0);
  }
  let first_t = (-half_sum_m - start_m) / sweep_m;
  let second_t = (half_sum_m - start_m) / sweep_m;
  return vec3<f32>(
    min(first_t, second_t),
    max(first_t, second_t),
    1.0
  );
}

fn interface_receipt_epoch_position(index: u32) -> vec3<f32> {
  let base = index * 16u;
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn interface_receipt_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn interface_receipt_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn interface_receipt_same_body_solid(
  self_index: u32,
  other_index: u32
) -> bool {
  if (
    interface_receipt_phase_class(self_index) != 2u
    || interface_receipt_phase_class(other_index) != 2u
  ) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if ((mechanical_params.identity_enabled & 1u) == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u
    || other_domain == 0u
    || self_domain == other_domain;
}

fn interface_receipt_unilateral_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  let self_class = interface_receipt_phase_class(self_index);
  let other_class = interface_receipt_phase_class(other_index);
  if (self_class == 0u || other_class == 0u) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return true; }
  if (
    (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u)
  ) { return true; }
  if (
    self_class != 2u
    || other_class != 2u
    || (mechanical_params.identity_enabled & 1u) == 0u
  ) { return false; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain != 0u
    && other_domain != 0u
    && self_domain != other_domain;
}

fn interface_receipt_pair_value(
  self_index: u32,
  other_index: u32
) -> f32 {
  // Receipt v3 refines the already-authenticated mechanical CSR; it does not
  // claim a second, complete AABB neighbor traversal. The broad mixed-law
  // envelope contains the campaign's staggered face candidates while keeping
  // receipt materialization O(E) in the retained directed graph.
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || interface_receipt_same_phase_lineage(self_index, other_index)
    || interface_receipt_same_body_solid(self_index, other_index)
    || !interface_receipt_unilateral_pair(self_index, other_index)
  ) { return 0.0; }
  let self_pos_mass = final_state[self_index * 2u];
  let other_pos_mass = final_state[other_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  let other_volume = max(
    source_mechanics[other_index * 8u + 4u].w,
    0.0
  );
  if (
    self_pos_mass.w <= 0.0
    || other_pos_mass.w <= 0.0
    || self_volume <= 0.0
    || other_volume <= 0.0
  ) { return -1.0; }
  let self_edge_m = interface_receipt_cbrt(self_volume);
  let other_edge_m = interface_receipt_cbrt(other_volume);
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let tolerance_m = max(
    1.0e-5,
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
      * half_sum_m
  );
  let final_delta = self_pos_mass.xyz - other_pos_mass.xyz;
  if (
    !interface_receipt_finite(self_edge_m)
    || !interface_receipt_finite(other_edge_m)
    || !interface_receipt_finite(half_sum_m)
    || !interface_receipt_finite(tolerance_m)
    || !interface_receipt_finite(final_delta.x)
    || !interface_receipt_finite(final_delta.y)
    || !interface_receipt_finite(final_delta.z)
  ) {
    return interface_receipt_invalid_value();
  }
  let final_face = interface_receipt_face_at_delta(
    final_delta,
    self_edge_m,
    other_edge_m,
    tolerance_m
  );
  if (final_face.admitted != 0u) { return final_face.area_m2; }
  // The unilateral solver owns swept-impact semantics. Preserve the exact
  // finite-volume face at first AABB impact even when later constraint cleanup
  // leaves the endpoints separated.
  let epoch_delta = interface_receipt_epoch_position(self_index)
    - interface_receipt_epoch_position(other_index);
  let sweep_delta = final_delta - epoch_delta;
  if (
    !interface_receipt_finite(epoch_delta.x)
    || !interface_receipt_finite(epoch_delta.y)
    || !interface_receipt_finite(epoch_delta.z)
    || !interface_receipt_finite(sweep_delta.x)
    || !interface_receipt_finite(sweep_delta.y)
    || !interface_receipt_finite(sweep_delta.z)
  ) {
    return interface_receipt_invalid_value();
  }
  let interval_x = interface_receipt_swept_axis_interval(
    epoch_delta.x,
    sweep_delta.x,
    half_sum_m
  );
  let interval_y = interface_receipt_swept_axis_interval(
    epoch_delta.y,
    sweep_delta.y,
    half_sum_m
  );
  let interval_z = interface_receipt_swept_axis_interval(
    epoch_delta.z,
    sweep_delta.z,
    half_sum_m
  );
  if (
    interval_x.z == 0.0
    || interval_y.z == 0.0
    || interval_z.z == 0.0
  ) { return -1.0; }
  if (
    !interface_receipt_finite(interval_x.x)
    || !interface_receipt_finite(interval_x.y)
    || !interface_receipt_finite(interval_y.x)
    || !interface_receipt_finite(interval_y.y)
    || !interface_receipt_finite(interval_z.x)
    || !interface_receipt_finite(interval_z.y)
  ) { return interface_receipt_invalid_value(); }
  let entry_t = max(interval_x.x, max(interval_y.x, interval_z.x));
  let exit_t = min(interval_x.y, min(interval_y.y, interval_z.y));
  if (entry_t > exit_t || exit_t < 0.0 || entry_t > 1.0) { return -1.0; }
  let impact_t = clamp(entry_t, 0.0, 1.0);
  let impact_face = interface_receipt_face_at_delta(
    epoch_delta + impact_t * sweep_delta,
    self_edge_m,
    other_edge_m,
    0.0
  );
  if (impact_face.admitted == 0u) { return -1.0; }
  return impact_face.area_m2;
}

fn interface_receipt_static_header_valid() -> bool {
  return arrayLength(&interface_receipt)
      >= INTERFACE_RECEIPT_HEADER_WORDS
    && atomicLoad(&interface_receipt[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC >>> 0}u
    && atomicLoad(&interface_receipt[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION}u
    && atomicLoad(&interface_receipt[2u])
      == mechanical_params.generation_id
    && atomicLoad(&interface_receipt[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&interface_receipt[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&interface_receipt[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&interface_receipt[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&interface_receipt[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&interface_receipt[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&interface_receipt[9u])
      == bitcast<u32>(mechanical_params.apply_selected_level)
    && atomicLoad(&interface_receipt[10u])
      == mechanical_params.particle_count
    && atomicLoad(&interface_receipt[11u])
      == mechanical_params.directed_pair_capacity
    && atomicLoad(&interface_receipt[12u])
      == mechanical_params.particle_count + 1u
    && atomicLoad(&interface_receipt[13u])
      == atomicLoad(&graph_control[12u]);
}

fn interface_receipt_index_hash(peer_index: u32, slot_count: u32) -> u32 {
  return (peer_index * INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER)
    % max(slot_count, 1u);
}

fn interface_receipt_index_static_header_valid() -> bool {
  if (!interface_receipt_static_header_valid()) { return false; }
  let total = atomicLoad(&interface_receipt[13u]);
  let offset_words = mechanical_params.particle_count + 1u;
  let prefix_words = INTERFACE_RECEIPT_HEADER_WORDS + offset_words;
  let available_words = arrayLength(&interface_receipt);
  if (
    prefix_words > available_words
    || total > (available_words - prefix_words) /
      (INTERFACE_RECEIPT_ROW_WORDS + INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW)
  ) { return false; }
  let expected_index_base = prefix_words
    + total * INTERFACE_RECEIPT_ROW_WORDS;
  let expected_slot_count = total * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
  return atomicLoad(
      &interface_receipt[INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD]
    ) == INTERFACE_RECEIPT_INDEX_ALGORITHM
    && atomicLoad(&interface_receipt[INTERFACE_RECEIPT_INDEX_BASE_WORD])
      == expected_index_base
    && atomicLoad(&interface_receipt[INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD])
      == expected_slot_count
    && expected_index_base <= available_words
    && expected_slot_count <= available_words - expected_index_base;
}

fn interface_receipt_index_insert(
  begin: u32,
  end: u32,
  peer_index: u32,
  receipt_cursor: u32
) -> bool {
  let degree = end - begin;
  let slot_count = degree * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
  if (degree == 0u || slot_count == 0u) { return false; }
  let index_base = atomicLoad(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_BASE_WORD]
  );
  let table_begin = index_base
    + begin * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
  var slot = interface_receipt_index_hash(peer_index, slot_count);
  for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
    let table_index = table_begin + slot;
    let resident_cursor = atomicLoad(&interface_receipt[table_index]);
    if (resident_cursor == INTERFACE_RECEIPT_INDEX_EMPTY) {
      atomicStore(&interface_receipt[table_index], receipt_cursor);
      return true;
    }
    if (resident_cursor == receipt_cursor) { return true; }
    slot = (slot + 1u) % slot_count;
  }
  return false;
}

@compute @workgroup_size(1)
fn initialize_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u) { return; }
  let total = atomicLoad(&graph_control[12u]);
  let offset_words = mechanical_params.particle_count + 1u;
  let available_words = arrayLength(&interface_receipt);
  let prefix_words = INTERFACE_RECEIPT_HEADER_WORDS + offset_words;
  let layout_valid = total <= mechanical_params.directed_pair_capacity
    && prefix_words <= available_words
    && total <= (available_words - prefix_words) / INTERFACE_RECEIPT_ROW_WORDS;
  let index_layout_valid = layout_valid
    && total <= (available_words - prefix_words) /
      (INTERFACE_RECEIPT_ROW_WORDS + INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW);
  var index_base = 0u;
  var index_slot_count = 0u;
  if (index_layout_valid) {
    index_base = prefix_words + total * INTERFACE_RECEIPT_ROW_WORDS;
    index_slot_count = total * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
  }
  atomicStore(
    &interface_receipt[0u],
    ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC >>> 0}u
  );
  atomicStore(
    &interface_receipt[1u],
    ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION}u
  );
  atomicStore(&interface_receipt[2u], mechanical_params.generation_id);
  atomicStore(&interface_receipt[3u], mechanical_params.storage_generation);
  atomicStore(&interface_receipt[4u], mechanical_params.physics_tick);
  atomicStore(&interface_receipt[5u], mechanical_params.physics_substep);
  atomicStore(&interface_receipt[6u], mechanical_params.position_epoch);
  atomicStore(&interface_receipt[7u], mechanical_params.topology_epoch);
  atomicStore(&interface_receipt[8u], mechanical_params.support_epoch);
  atomicStore(
    &interface_receipt[9u],
    bitcast<u32>(mechanical_params.apply_selected_level)
  );
  atomicStore(&interface_receipt[10u], mechanical_params.particle_count);
  atomicStore(
    &interface_receipt[11u],
    mechanical_params.directed_pair_capacity
  );
  atomicStore(&interface_receipt[12u], offset_words);
  atomicStore(&interface_receipt[13u], total);
  atomicStore(&interface_receipt[14u], 0u);
  atomicStore(
    &interface_receipt[15u],
    select(
      INTERFACE_RECEIPT_STATUS_READY
        | INTERFACE_RECEIPT_STATUS_FAIL_CLOSED,
      INTERFACE_RECEIPT_STATUS_BUILDING,
      layout_valid
    )
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD],
    INTERFACE_RECEIPT_INDEX_ALGORITHM
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_BASE_WORD],
    index_base
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD],
    index_slot_count
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD],
    0u
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD],
    0u
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
    select(
      INTERFACE_RECEIPT_INDEX_STATUS_READY
        | INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED,
      INTERFACE_RECEIPT_INDEX_STATUS_BUILDING,
      index_layout_valid
    )
  );
}

@compute @workgroup_size(64)
fn materialize_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (
    !interface_receipt_static_header_valid()
    || atomicLoad(&interface_receipt[15u])
      != INTERFACE_RECEIPT_STATUS_BUILDING
    || atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[17u]) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) == 0u
  ) {
    atomicOr(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
    );
    atomicOr(
      &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
      INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED
    );
    return;
  }
  let total = atomicLoad(&interface_receipt[13u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total) {
    atomicOr(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
    );
    atomicOr(
      &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
      INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED
    );
    return;
  }
  let offset_base = INTERFACE_RECEIPT_HEADER_WORDS;
  atomicStore(&interface_receipt[offset_base + self_index], begin);
  if (self_index + 1u == mechanical_params.particle_count) {
    atomicStore(
      &interface_receipt[offset_base + mechanical_params.particle_count],
      end
    );
  }
  let row_base = offset_base + mechanical_params.particle_count + 1u;
  var index_building = interface_receipt_index_static_header_valid()
    && atomicLoad(&interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD])
      == INTERFACE_RECEIPT_INDEX_STATUS_BUILDING;
  let degree = end - begin;
  if (index_building) {
    let index_base = atomicLoad(
      &interface_receipt[INTERFACE_RECEIPT_INDEX_BASE_WORD]
    );
    let table_begin = index_base
      + begin * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
    let slot_count = degree * INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW;
    for (var slot = 0u; slot < slot_count; slot = slot + 1u) {
      atomicStore(
        &interface_receipt[table_begin + slot],
        INTERFACE_RECEIPT_INDEX_EMPTY
      );
    }
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = csr_peers[cursor];
    let pair_value = interface_receipt_pair_value(
      self_index,
      peer_index
    );
    if (!interface_receipt_finite(pair_value)) {
      atomicOr(
        &interface_receipt[15u],
        INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
      );
      atomicOr(
        &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
        INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED
      );
      return;
    }
    let row = row_base + cursor * INTERFACE_RECEIPT_ROW_WORDS;
    atomicStore(&interface_receipt[row], peer_index);
    atomicStore(&interface_receipt[row + 1u], bitcast<u32>(pair_value));
    if (
      index_building
      && !interface_receipt_index_insert(
        begin,
        end,
        peer_index,
        cursor
      )
    ) {
      atomicOr(
        &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
        INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED
      );
      index_building = false;
    }
  }
  if (index_building) {
    atomicAdd(
      &interface_receipt[
        INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD
      ],
      1u
    );
    atomicAdd(
      &interface_receipt[
        INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD
      ],
      degree
    );
  }
  // This core-row counter is the final per-source publication operation. Seal
  // cannot admit either the base receipt or its optional index until every
  // preceding row, slot, and index counter write is visible.
  atomicAdd(&interface_receipt[14u], degree);
}

@compute @workgroup_size(1)
fn seal_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u) { return; }
  let required_stages =
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.COMMITTED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_TRUST_RESTORED}u;
  let admitted =
    interface_receipt_static_header_valid()
    && atomicLoad(&interface_receipt[15u])
      == INTERFACE_RECEIPT_STATUS_BUILDING
    && atomicLoad(&interface_receipt[14u])
      == atomicLoad(&interface_receipt[13u])
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
    && atomicLoad(&graph_control[17u]) == mechanical_params.particle_count
    && atomicLoad(&graph_control[18u]) == mechanical_params.particle_count
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) == ${solverBudget.cleanupPassBudget}u
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) == mechanical_params.particle_count
    && (atomicLoad(&graph_control[15u]) & required_stages)
      == required_stages;
  let index_admitted = admitted
    && interface_receipt_index_static_header_valid()
    && atomicLoad(&interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD])
      == INTERFACE_RECEIPT_INDEX_STATUS_BUILDING
    && atomicLoad(
      &interface_receipt[
        INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD
      ]
    ) == mechanical_params.particle_count
    && atomicLoad(
      &interface_receipt[
        INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD
      ]
    ) == atomicLoad(&interface_receipt[13u]);
  if (!admitted) {
    let graph_failure = atomicLoad(&graph_control[14u]);
    let pass_cap_only_mask =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.POSITION_RESIDUAL}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.VELOCITY_RESIDUAL}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u;
    let pass_cap_fallback_admitted =
      interface_receipt_static_header_valid()
      && graph_failure != 0u
      && (graph_failure & (~pass_cap_only_mask)) == 0u;
    atomicStore(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_READY
        | INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
        | select(
          0u,
          INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK,
          pass_cap_fallback_admitted
        )
    );
    atomicStore(
      &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
      INTERFACE_RECEIPT_INDEX_STATUS_READY
        | INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED
    );
    return;
  }
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
      .CONTACT_INTERFACE_RECEIPT_PUBLISHED}u
  );
  atomicStore(
    &interface_receipt[15u],
    INTERFACE_RECEIPT_STATUS_READY | INTERFACE_RECEIPT_STATUS_ADMITTED
  );
  atomicStore(
    &interface_receipt[INTERFACE_RECEIPT_INDEX_STATUS_WORD],
    select(
      INTERFACE_RECEIPT_INDEX_STATUS_READY
        | INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED,
      INTERFACE_RECEIPT_INDEX_STATUS_READY
        | INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED,
      index_admitted
    )
  );
}
`;
}

export function createSchroederSpatialMechanicalProposalApplyWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> original_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> final_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(7) var<storage, read_write> matching_cleanup_control:
  array<atomic<u32>>;

fn mechanical_publish_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_publish_finite3(value: vec3<f32>) -> bool {
  return mechanical_publish_finite(value.x)
    && mechanical_publish_finite(value.y)
    && mechanical_publish_finite(value.z);
}

fn mechanical_publish_measure_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 19u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount8}u
    + (iteration - 8u);
}

fn mechanical_publish_solve_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 23u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount8}u
    + (iteration - 8u);
}

fn mechanical_publish_energy_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 32u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .energyMeasureCount4}u + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .energyMeasureCount8}u + (iteration - 8u);
}

fn mechanical_publish_header_word(word: u32) -> u32 {
  return bitcast<u32>(proposal_rows[word / 4u][word % 4u]);
}

fn mechanical_publish_header_valid() -> bool {
  return arrayLength(&proposal_rows)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
        + mechanical_params.particle_count * 2u
    && mechanical_publish_header_word(0u)
      == mechanical_params.proposal_magic
    && mechanical_publish_header_word(1u)
      == mechanical_params.proposal_version
    && mechanical_publish_header_word(2u)
      == mechanical_params.generation_id
    && mechanical_publish_header_word(3u)
      == mechanical_params.support_epoch
    && mechanical_publish_header_word(4u)
      == mechanical_params.particle_count
    && mechanical_publish_header_word(5u)
      == mechanical_params.proposal_row_words
    && mechanical_publish_header_word(6u)
      == mechanical_params.contact_support_profile_id
    && mechanical_publish_header_word(7u)
      == mechanical_params.separation_support_profile_id
    && mechanical_publish_header_word(8u)
      == mechanical_params.interface_support_profile_id
    && mechanical_publish_header_word(9u)
      == mechanical_params.position_epoch
    && mechanical_publish_header_word(10u)
      == mechanical_params.topology_epoch
    && mechanical_publish_header_word(11u)
      == mechanical_params.storage_generation
    && mechanical_publish_header_word(12u)
      == mechanical_params.physics_tick
    && mechanical_publish_header_word(13u)
      == mechanical_params.physics_substep
    && mechanical_publish_header_word(14u)
      == mechanical_params.traversal_count
    && mechanical_publish_header_word(15u)
      == mechanical_params.consumer_count;
}

fn mechanical_publish_graph_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

fn mechanical_publish_matching_cleanup_header_valid() -> bool {
  return arrayLength(&matching_cleanup_control)
      >= ${solverBudget.matchingCleanupControlWords}u
    && atomicLoad(&matching_cleanup_control[0u])
      == ${MATCHING_CLEANUP_CONTROL_MAGIC}u
    && atomicLoad(&matching_cleanup_control[1u])
      == ${MATCHING_CLEANUP_CONTROL_VERSION}u
    && atomicLoad(&matching_cleanup_control[2u])
      == mechanical_params.generation_id
    && atomicLoad(&matching_cleanup_control[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&matching_cleanup_control[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&matching_cleanup_control[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&matching_cleanup_control[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&matching_cleanup_control[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&matching_cleanup_control[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&matching_cleanup_control[9u])
      == mechanical_params.particle_count
    && atomicLoad(&matching_cleanup_control[10u])
      == mechanical_params.solver_iteration_count
    && atomicLoad(&matching_cleanup_control[11u])
      == ${solverBudget.cleanupPassBudget}u;
}

@compute @workgroup_size(64)
fn publish_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
    return;
  }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[17u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) == 0u
  ) { return; }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  let final_position = final_state[particle_index * 2u];
  let final_velocity = final_state[particle_index * 2u + 1u];
  let dx = final_position.xyz - original_position.xyz;
  let dv = final_velocity.xyz - original_velocity.xyz;
  let du = final_velocity.w - original_velocity.w;
  let mechanical_heat_j = final_position.w * du;
  if (
    !mechanical_publish_finite3(dx)
    || !mechanical_publish_finite3(dv)
    || !mechanical_publish_finite(du)
    || !mechanical_publish_finite(mechanical_heat_j)
    || du < 0.0
    || mechanical_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(dx, mechanical_heat_j);
  proposal_rows[proposal_row + 1u] = vec4<f32>(dv, du);
  atomicAdd(&graph_control[18u], 1u);
}

// The retained graph remains authoritative even when it has no rows: this
// path is reached only after exact traversal, the source-count scan, and the
// finalized append/CSR counters all agree on zero directed pairs.  It avoids
// running sixteen vacuous Jacobi rounds over every particle while publishing the
// same zero proposal rows and authenticated completion evidence.
@compute @workgroup_size(64)
fn complete_zero_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  let required_stages =
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u;
  let zero_graph_admitted =
    mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid()
    && mechanical_publish_matching_cleanup_header_valid()
    && mechanical_params.solver_iteration_count
      == ${solverBudget.jacobiIterations}u
    && atomicLoad(&graph_control[11u]) == 0u
    && atomicLoad(&graph_control[12u]) == 0u
    && atomicLoad(&graph_control[13u]) == 0u
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u])
      == (mechanical_params.particle_count + 63u) / 64u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchY}u]) == 1u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchZ}u]) == 1u
    && (
      atomicLoad(&graph_control[15u]) & required_stages
    ) == required_stages;
  if (!zero_graph_admitted) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  if (
    !mechanical_publish_finite3(original_position.xyz)
    || !mechanical_publish_finite(original_position.w)
    || !mechanical_publish_finite3(original_velocity.xyz)
    || !mechanical_publish_finite(original_velocity.w)
    || original_position.w < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  // Scratch B is the normal even-round final state buffer. Initializing it
  // from the immutable post-G2P state lets the ordinary seal/commit path
  // remain the sole public-state publication path.
  output_state[particle_index * 2u] = original_position;
  output_state[particle_index * 2u + 1u] = original_velocity;
  atomicAdd(&graph_control[16u], 1u);
  atomicAdd(&graph_control[17u], 1u);
  atomicAdd(&graph_control[18u], 1u);
  for (var iteration = 0u;
    iteration < mechanical_params.solver_iteration_count;
    iteration = iteration + 1u) {
    atomicAdd(
      &graph_control[mechanical_publish_measure_count_word(iteration)],
      1u
    );
    atomicAdd(
      &graph_control[mechanical_publish_solve_count_word(iteration)],
      1u
    );
    atomicAdd(
      &graph_control[mechanical_publish_energy_count_word(iteration)],
      1u
    );
  }
  if (particle_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicAdd(
      &traversal_evidence[28u],
      mechanical_params.solver_iteration_count
    );
    atomicAdd(
      &traversal_evidence[29u],
      mechanical_params.solver_iteration_count
    );
    atomicAdd(
      &traversal_evidence[32u],
      mechanical_params.solver_iteration_count
    );
    // The authenticated zero-edge route is an explicit solver bypass: no
    // conflict graph exists to clean up, but it still synthesizes the same
    // terminal cleanup certificate required by publication consumers.
    atomicStore(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u],
      ${solverBudget.cleanupPassBudget}u
    );
    atomicStore(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u],
      mechanical_params.particle_count
    );
    for (
      var cleanup_pass = 0u;
      cleanup_pass
        < ${solverBudget.cleanupPassBudget}u;
      cleanup_pass = cleanup_pass + 1u
    ) {
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.selectionCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.copyCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.applyCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.wallCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.appliedPairCountWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.maxPositionRatioWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.maxVelocityResidualWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.contactCountWord}u + cleanup_pass
        ],
        0u
      );
    }
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_4}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_5}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_6}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_7}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_4}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_5}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_6}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_7}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATIONS_8_15}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
        .ENERGY_ITERATIONS_8_15}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.MATCHING_CLEANUP}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
        .MATCHING_TRUST_RESTORED}u
    );
  }
}

@compute @workgroup_size(1)
fn seal_contact_proposal() {
  let headers_valid = mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid();
  if (!headers_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
  }
  let residual_verified =
    atomicLoad(&graph_control[17u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) != 0u;
  let rows_complete = atomicLoad(&graph_control[18u])
    == mechanical_params.particle_count;
  if (
    !headers_valid
    || !residual_verified
    || !rows_complete
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    // Evidence status is a bit field. A terminal rejection is both observable
    // (READY) and fail-closed; publishing only FAIL_CLOSED would leave readers
    // unable to distinguish an unfinished dispatch from a sealed rejection.
    atomicStore(&traversal_evidence[2u], 5u);
    return;
  }
  atomicStore(
    &traversal_evidence[14u],
    atomicLoad(&graph_control[11u])
  );
  atomicStore(
    &traversal_evidence[16u],
    atomicLoad(&graph_control[12u])
  );
  atomicStore(
    &traversal_evidence[17u],
    atomicLoad(&graph_control[13u])
  );
  atomicStore(
    &traversal_evidence[30u],
    atomicLoad(&graph_control[27u])
  );
  atomicStore(
    &traversal_evidence[31u],
    atomicLoad(&graph_control[28u])
  );
  atomicAdd(&traversal_evidence[27u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
  );
  // Status is the externally observed publication word; write it only after
  // every proposal row and all retained evidence have been sealed.
  atomicStore(&traversal_evidence[2u], 3u);
}

@compute @workgroup_size(64)
fn commit_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[18u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
    ) == 0u
    || !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    return;
  }
  output_state[particle_index * 2u] = final_state[particle_index * 2u];
  output_state[particle_index * 2u + 1u]
    = final_state[particle_index * 2u + 1u];
  if (particle_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.COMMITTED}u
    );
  }
}
`;
}

