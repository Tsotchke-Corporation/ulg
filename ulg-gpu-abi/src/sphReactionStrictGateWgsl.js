import {
  SPH_REACTION_STRICT_GATE_BLOCKER,
  SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
  SPH_REACTION_STRICT_GATE_INDEX,
  SPH_REACTION_STRICT_GATE_MAGIC,
  SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS,
  SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT,
  SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS,
  SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK,
  SPH_REACTION_STRICT_GATE_STATUS,
  SPH_REACTION_STRICT_GATE_VERSION,
  SPH_REACTION_STRICT_GATE_WORDS
} from './sphReactionStrictGate.js';

// A single deterministic GPU invocation seals the compact reaction gate. The
// producer receipt and atom-term authority are read-only: the finalizer cannot
// populate, repair, or self-authenticate either source. Each residual slot is
// matched to the exact atom-term slot before its values enter an accumulator.
export const sphReactionStrictGateFinalizeWgsl = `
struct ReactionStrictGateParams {
  reaction_count: u32,
  atom_term_count: u32,
  atom_residual_capacity: u32,
  atom_term_capacity: u32,
  expected_source_generation: u32,
  expected_completion_generation: u32,
  expected_seal: u32,
  static_blocker_flags: u32,
  atom_tolerance_bits: u32,
  charge_tolerance_bits: u32,
  atom_residual_stride_vec4: u32,
  atom_term_stride_vec4: u32,
  gate_word_count: u32,
  expected_gate_version: u32,
  producer_receipt_word_count: u32,
  expected_producer_receipt_version: u32,
};

@group(0) @binding(0) var<storage, read> atom_residual_evidence: array<u32>;
@group(0) @binding(1) var<storage, read> atom_term_authority: array<u32>;
@group(0) @binding(2) var<storage, read> producer_receipt: array<u32>;
@group(0) @binding(3) var<storage, read_write> reaction_strict_gate: array<u32>;
@group(0) @binding(4) var<uniform> params: ReactionStrictGateParams;
@group(0) @binding(5) var<storage, read> producer_shadow_bits: array<u32>;

const GATE_MAGIC: u32 = ${SPH_REACTION_STRICT_GATE_MAGIC}u;
const GATE_VERSION: u32 = ${SPH_REACTION_STRICT_GATE_VERSION}u;
const GATE_WORDS: u32 = ${SPH_REACTION_STRICT_GATE_WORDS}u;
const PRODUCER_RECEIPT_MAGIC: u32 = ${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC}u;
const PRODUCER_RECEIPT_VERSION: u32 = ${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION}u;
const PRODUCER_RECEIPT_WORDS: u32 = ${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS}u;
const PRODUCER_RECEIPT_READY: u32 = ${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.READY}u;
const MAX_ATOMIC_NUMBER: u32 = ${SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER}u;
const F32_INDEX_EXCLUSIVE: u32 = ${SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE}u;
const SHADOW_ROW_WORDS: u32 = ${SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS}u;
const SHADOW_PLANE_COUNT: u32 = ${SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT}u;

const STATUS_INITIALIZED: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.INITIALIZED}u;
const STATUS_EVIDENCE_COMPLETE: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.EVIDENCE_COMPLETE}u;
const STATUS_FINALIZED: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.FINALIZED}u;
const STATUS_PASS: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.PASS}u;
const STATUS_BLOCKED: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.BLOCKED}u;
const STATUS_FAIL_CLOSED: u32 = ${SPH_REACTION_STRICT_GATE_STATUS.FAIL_CLOSED}u;

const BLOCKER_MISSING_EVIDENCE: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE}u;
const BLOCKER_PROBLEM_ROW: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW}u;
const BLOCKER_NONFINITE_EVIDENCE: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE}u;
const BLOCKER_ATOM_RESIDUAL: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE}u;
const BLOCKER_CHARGE_RESIDUAL: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_RESIDUAL_OUT_OF_TOLERANCE}u;
const BLOCKER_GENERATION_MISMATCH: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH}u;
const BLOCKER_SEAL_MISMATCH: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH}u;
const BLOCKER_STATIC_INPUT_INVALID: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID}u;
const BLOCKER_LAYOUT_MISMATCH: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH}u;
const BLOCKER_BITWISE_SHADOW_MISMATCH: u32 = ${SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH}u;
const STATIC_BLOCKER_MASK: u32 = ${SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK}u;

struct SoftF32AddResult {
  bits: u32,
  finite: bool,
};

fn finite_f32_bits(bits: u32) -> bool {
  return (bits & 0x7fffffffu) <= 0x7f7fffffu;
}

fn positive_f32_bits(bits: u32) -> bool {
  return finite_f32_bits(bits)
    && (bits & 0x80000000u) == 0u
    && (bits & 0x7fffffffu) != 0u;
}

fn shift_right_jam_u32(value: u32, distance: u32) -> u32 {
  if (distance == 0u) {
    return value;
  }
  if (distance < 32u) {
    let shifted = value >> distance;
    let discarded = value << (32u - distance);
    return shifted | select(0u, 1u, discarded != 0u);
  }
  return select(0u, 1u, value != 0u);
}

// Deterministic IEEE-754 binary32 addition in the integer bit domain. WGSL
// permits either adjacent rounded result and flush-to-zero for ordinary f32
// arithmetic; admission authority cannot depend on those freedoms. This
// software path performs round-to-nearest, ties-to-even with gradual
// underflow and an explicit infinity result on overflow, matching Math.fround.
fn add_rte_f32_bits(a_bits: u32, b_bits: u32) -> SoftF32AddResult {
  let a_exponent_field = (a_bits >> 23u) & 0xffu;
  let b_exponent_field = (b_bits >> 23u) & 0xffu;
  if (a_exponent_field == 0xffu || b_exponent_field == 0xffu) {
    return SoftF32AddResult(0x7f800000u, false);
  }

  let a_fraction = a_bits & 0x007fffffu;
  let b_fraction = b_bits & 0x007fffffu;
  var a_significand = select(
    0x00800000u | a_fraction,
    a_fraction,
    a_exponent_field == 0u
  );
  var b_significand = select(
    0x00800000u | b_fraction,
    b_fraction,
    b_exponent_field == 0u
  );
  if (a_significand == 0u && b_significand == 0u) {
    return SoftF32AddResult(0u, true);
  }
  if (a_significand == 0u) {
    return SoftF32AddResult(b_bits, true);
  }
  if (b_significand == 0u) {
    return SoftF32AddResult(a_bits, true);
  }

  var a_exponent = select(
    a_exponent_field,
    1u,
    a_exponent_field == 0u
  );
  var b_exponent = select(
    b_exponent_field,
    1u,
    b_exponent_field == 0u
  );
  let a_sign = a_bits >> 31u;
  let b_sign = b_bits >> 31u;
  var result_sign = 0u;
  var result_exponent = 1u;
  var extended = 0u;

  if (a_sign == b_sign) {
    result_sign = a_sign;
    if (a_exponent < b_exponent) {
      let saved_exponent = a_exponent;
      let saved_significand = a_significand;
      a_exponent = b_exponent;
      a_significand = b_significand;
      b_exponent = saved_exponent;
      b_significand = saved_significand;
    }
    result_exponent = a_exponent;
    extended = (a_significand << 3u)
      + shift_right_jam_u32(
        b_significand << 3u,
        a_exponent - b_exponent
      );
    if ((extended & 0x08000000u) != 0u) {
      extended = shift_right_jam_u32(extended, 1u);
      result_exponent = result_exponent + 1u;
    }
  } else {
    let a_is_larger = a_exponent > b_exponent
      || (
        a_exponent == b_exponent
        && a_significand >= b_significand
      );
    if (
      a_exponent == b_exponent
      && a_significand == b_significand
    ) {
      return SoftF32AddResult(0u, true);
    }
    var larger_exponent = b_exponent;
    var smaller_exponent = a_exponent;
    var larger_significand = b_significand;
    var smaller_significand = a_significand;
    result_sign = b_sign;
    if (a_is_larger) {
      larger_exponent = a_exponent;
      smaller_exponent = b_exponent;
      larger_significand = a_significand;
      smaller_significand = b_significand;
      result_sign = a_sign;
    }
    result_exponent = larger_exponent;
    extended = (larger_significand << 3u)
      - shift_right_jam_u32(
        smaller_significand << 3u,
        larger_exponent - smaller_exponent
      );
    while (
      result_exponent > 1u
      && (extended & 0x04000000u) == 0u
    ) {
      extended = extended << 1u;
      result_exponent = result_exponent - 1u;
    }
  }

  var rounded_significand = extended >> 3u;
  let round_bits = extended & 0x7u;
  if (
    round_bits > 0x4u
    || (
      round_bits == 0x4u
      && (rounded_significand & 0x1u) != 0u
    )
  ) {
    rounded_significand = rounded_significand + 1u;
    if (rounded_significand == 0x01000000u) {
      rounded_significand = 0x00800000u;
      result_exponent = result_exponent + 1u;
    }
  }
  if (result_exponent >= 0xffu) {
    return SoftF32AddResult(
      (result_sign << 31u) | 0x7f800000u,
      false
    );
  }
  var output_exponent = result_exponent;
  if (result_exponent == 1u && rounded_significand < 0x00800000u) {
    output_exponent = 0u;
  }
  let result_bits = (result_sign << 31u)
    | (output_exponent << 23u)
    | (rounded_significand & 0x007fffffu);
  return SoftF32AddResult(result_bits, true);
}

fn nonnegative_integer_f32_bits(bits: u32) -> bool {
  if ((bits & 0x80000000u) != 0u || !finite_f32_bits(bits)) {
    return false;
  }
  let exponent_field = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x007fffffu;
  if (exponent_field == 0u) {
    return fraction == 0u;
  }
  if (exponent_field < 127u) {
    return false;
  }
  if (exponent_field >= 150u) {
    return true;
  }
  let fractional_bit_count = 150u - exponent_field;
  let fractional_mask = (1u << fractional_bit_count) - 1u;
  return (fraction & fractional_mask) == 0u;
}

fn exact_f32_index_bits(bits: u32) -> bool {
  return nonnegative_integer_f32_bits(bits)
    && bits < 0x4b800000u;
}

fn nonnegative_integer_f32_bits_to_u32(bits: u32) -> u32 {
  let exponent_field = (bits >> 23u) & 0xffu;
  if (exponent_field == 0u) {
    return 0u;
  }
  if (exponent_field < 127u) {
    return 0u;
  }
  if (exponent_field > 158u) {
    return 0xffffffffu;
  }
  let significand = 0x00800000u | (bits & 0x007fffffu);
  let exponent = exponent_field - 127u;
  if (exponent >= 23u) {
    return significand << (exponent - 23u);
  }
  return significand >> (23u - exponent);
}

@compute @workgroup_size(1)
fn finalize_reaction_strict_gate(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&reaction_strict_gate) < GATE_WORDS) {
    return;
  }

  var receipt_source_generation = 0u;
  var receipt_completion_generation = 0u;
  var receipt_seal = 0u;
  var receipt_shadow_plane_word_count = 0u;
  var receipt_shadow_logical_word_count = 0u;
  let receipt_length_valid = arrayLength(&producer_receipt) == PRODUCER_RECEIPT_WORDS;
  if (receipt_length_valid) {
    receipt_source_generation = producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.sourceGeneration}u];
    receipt_completion_generation = producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.completionGeneration}u];
    receipt_seal = producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.seal}u];
    receipt_shadow_plane_word_count = producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.shadowPlaneWordCount}u];
    receipt_shadow_logical_word_count = producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.shadowLogicalWordCount}u];
  }

  // Preserve a blocked terminal value throughout finalization. PASS is the
  // final publication write and exists only when every invariant below holds.
  for (var word = 0u; word < GATE_WORDS; word = word + 1u) {
    reaction_strict_gate[word] = 0u;
  }
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.magic}u] = GATE_MAGIC;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.version}u] = GATE_VERSION;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.statusFlags}u] =
    STATUS_INITIALIZED | STATUS_BLOCKED | STATUS_FAIL_CLOSED;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.blockerFlags}u] =
    BLOCKER_MISSING_EVIDENCE;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.sourceGeneration}u] =
    receipt_source_generation;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.completionGeneration}u] =
    receipt_completion_generation;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.seal}u] = receipt_seal;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.reactionCount}u] =
    params.reaction_count;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.atomTermCount}u] =
    params.atom_term_count;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.atomResidualToleranceMol}u] =
    params.atom_tolerance_bits;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.chargeResidualToleranceMol}u] =
    params.charge_tolerance_bits;

  var blockers = params.static_blocker_flags & STATIC_BLOCKER_MASK;
  if ((params.static_blocker_flags & ~STATIC_BLOCKER_MASK) != 0u) {
    blockers = blockers | BLOCKER_STATIC_INPUT_INVALID;
  }
  var layout_valid = true;
  if (
    params.atom_residual_stride_vec4 != 2u
    || params.atom_term_stride_vec4 != 2u
    || params.gate_word_count != GATE_WORDS
    || params.expected_gate_version != GATE_VERSION
    || params.producer_receipt_word_count != PRODUCER_RECEIPT_WORDS
    || params.expected_producer_receipt_version != PRODUCER_RECEIPT_VERSION
    || params.reaction_count >= F32_INDEX_EXCLUSIVE
    || params.atom_term_count >= F32_INDEX_EXCLUSIVE
    || params.atom_residual_capacity >= F32_INDEX_EXCLUSIVE
    || params.atom_term_capacity >= F32_INDEX_EXCLUSIVE
    || params.atom_residual_capacity < params.atom_term_count
    || params.atom_term_capacity < params.atom_term_count
    || ((params.reaction_count == 0u) != (params.atom_term_count == 0u))
    || arrayLength(&reaction_strict_gate) != GATE_WORDS
  ) {
    blockers = blockers | BLOCKER_LAYOUT_MISMATCH;
    layout_valid = false;
  }

  if (
    params.expected_source_generation == 0u
    || params.expected_completion_generation == 0u
    || !receipt_length_valid
    || receipt_source_generation != params.expected_source_generation
    || receipt_completion_generation != params.expected_completion_generation
  ) {
    blockers = blockers
      | BLOCKER_MISSING_EVIDENCE
      | BLOCKER_GENERATION_MISMATCH;
  }
  if (
    params.expected_seal == 0u
    || !receipt_length_valid
    || receipt_seal != params.expected_seal
  ) {
    blockers = blockers
      | BLOCKER_MISSING_EVIDENCE
      | BLOCKER_SEAL_MISMATCH;
  }

  if (!receipt_length_valid) {
    blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
    layout_valid = false;
  } else if (
    producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.magic}u] != PRODUCER_RECEIPT_MAGIC
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.version}u] != PRODUCER_RECEIPT_VERSION
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.statusFlags}u] != PRODUCER_RECEIPT_READY
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.blockerFlags}u] != 0u
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.reactionCount}u] != params.reaction_count
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomTermCount}u] != params.atom_term_count
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomResidualCapacity}u] != params.atom_residual_capacity
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomTermCapacity}u] != params.atom_term_capacity
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomResidualStrideVec4}u] != params.atom_residual_stride_vec4
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomTermStrideVec4}u] != params.atom_term_stride_vec4
    || producer_receipt[${SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.producerSequence}u] == 0u
    || receipt_shadow_plane_word_count != params.atom_term_count * SHADOW_ROW_WORDS
    || receipt_shadow_logical_word_count != receipt_shadow_plane_word_count * SHADOW_PLANE_COUNT
  ) {
    blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
    layout_valid = false;
  }

  if (
    !finite_f32_bits(params.atom_tolerance_bits)
    || (params.atom_tolerance_bits & 0x80000000u) != 0u
    || !finite_f32_bits(params.charge_tolerance_bits)
    || (params.charge_tolerance_bits & 0x80000000u) != 0u
  ) {
    blockers = blockers | BLOCKER_STATIC_INPUT_INVALID;
  }

  let evidence_word_count = arrayLength(&atom_residual_evidence);
  let atom_term_word_count = arrayLength(&atom_term_authority);
  let shadow_word_count = arrayLength(&producer_shadow_bits);
  var expected_evidence_binding_word_count =
    params.atom_residual_capacity * SHADOW_ROW_WORDS;
  var expected_atom_term_binding_word_count =
    params.atom_term_capacity * SHADOW_ROW_WORDS;
  var expected_shadow_binding_word_count = receipt_shadow_logical_word_count;
  if (expected_evidence_binding_word_count == 0u) {
    expected_evidence_binding_word_count = 1u;
  }
  if (expected_atom_term_binding_word_count == 0u) {
    expected_atom_term_binding_word_count = 1u;
  }
  if (expected_shadow_binding_word_count == 0u) {
    expected_shadow_binding_word_count = 1u;
  }
  if (
    evidence_word_count != expected_evidence_binding_word_count
    || atom_term_word_count != expected_atom_term_binding_word_count
    || shadow_word_count != expected_shadow_binding_word_count
  ) {
    blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
    layout_valid = false;
  }
  if (params.atom_residual_capacity == 0u) {
    if (evidence_word_count != 1u || atom_residual_evidence[0u] != 0u) {
      blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
      layout_valid = false;
    }
  }
  if (params.atom_term_capacity == 0u) {
    if (atom_term_word_count != 1u || atom_term_authority[0u] != 0u) {
      blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
      layout_valid = false;
    }
  }
  if (receipt_shadow_logical_word_count == 0u) {
    if (shadow_word_count != 1u || producer_shadow_bits[0u] != 0u) {
      blockers = blockers | BLOCKER_MISSING_EVIDENCE | BLOCKER_LAYOUT_MISMATCH;
      layout_valid = false;
    }
  }

  var inspect_count = 0u;
  if (layout_valid) {
    inspect_count = params.atom_term_count;
  } else {
    blockers = blockers | BLOCKER_MISSING_EVIDENCE;
  }
  var ready_row_count = 0u;
  var problem_row_count = params.atom_term_count - inspect_count;
  var atom_residual_bits_by_z: array<u32, 119>;
  for (var atomic_number = 0u; atomic_number <= MAX_ATOMIC_NUMBER; atomic_number = atomic_number + 1u) {
    atom_residual_bits_by_z[atomic_number] = 0u;
  }
  var has_current_reaction = false;
  var current_reaction = 0u;
  var seen_reaction_count = 0u;
  var current_charge_residual_bits = 0u;
  var max_abs_atom_residual_bits = 0u;
  var max_abs_charge_residual_bits = 0u;

  for (var row_index = 0u; row_index < inspect_count; row_index = row_index + 1u) {
    let row_word_offset = row_index * SHADOW_ROW_WORDS;
    let term_shadow_word_offset = receipt_shadow_plane_word_count + row_word_offset;
    var shadow_matches = true;
    for (var lane = 0u; lane < SHADOW_ROW_WORDS; lane = lane + 1u) {
      shadow_matches = shadow_matches
        && atom_residual_evidence[row_word_offset + lane]
          == producer_shadow_bits[row_word_offset + lane]
        && atom_term_authority[row_word_offset + lane]
          == producer_shadow_bits[term_shadow_word_offset + lane];
    }
    if (!shadow_matches) {
      problem_row_count = problem_row_count + 1u;
      blockers = blockers
        | BLOCKER_MISSING_EVIDENCE
        | BLOCKER_BITWISE_SHADOW_MISMATCH;
      continue;
    }
    var finite = true;
    var term_finite = true;
    for (var lane = 0u; lane < SHADOW_ROW_WORDS; lane = lane + 1u) {
      finite = finite
        && finite_f32_bits(atom_residual_evidence[row_word_offset + lane]);
      term_finite = term_finite
        && finite_f32_bits(atom_term_authority[row_word_offset + lane]);
    }
    if (!finite || !term_finite) {
      blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
    }

    let row_reaction_bits = atom_residual_evidence[row_word_offset];
    let row_atomic_number_bits = atom_residual_evidence[row_word_offset + 1u];
    let row_event_count_bits = atom_residual_evidence[row_word_offset + 4u];
    let row_term_kind_bits = atom_residual_evidence[row_word_offset + 5u];
    let row_term_index_bits = atom_residual_evidence[row_word_offset + 6u];
    let row_status_bits = atom_residual_evidence[row_word_offset + 7u];
    let term_reaction_bits = atom_term_authority[row_word_offset];
    let term_kind_bits = atom_term_authority[row_word_offset + 1u];
    let term_index_bits = atom_term_authority[row_word_offset + 2u];
    let term_atomic_number_bits = atom_term_authority[row_word_offset + 3u];
    let term_status_bits = atom_term_authority[row_word_offset + 7u];
    let row_ready = finite
      && exact_f32_index_bits(row_reaction_bits)
      && nonnegative_integer_f32_bits_to_u32(row_reaction_bits)
        < params.reaction_count
      && nonnegative_integer_f32_bits(row_atomic_number_bits)
      && nonnegative_integer_f32_bits_to_u32(row_atomic_number_bits) >= 1u
      && nonnegative_integer_f32_bits_to_u32(row_atomic_number_bits)
        <= MAX_ATOMIC_NUMBER
      && nonnegative_integer_f32_bits(row_event_count_bits)
      && nonnegative_integer_f32_bits_to_u32(row_event_count_bits)
        <= F32_INDEX_EXCLUSIVE
      && (row_term_kind_bits == 0x3f800000u || row_term_kind_bits == 0x40000000u)
      && exact_f32_index_bits(row_term_index_bits)
      && row_status_bits == 0x3f800000u;
    let term_ready = term_finite
      && exact_f32_index_bits(term_reaction_bits)
      && nonnegative_integer_f32_bits_to_u32(term_reaction_bits)
        < params.reaction_count
      && (term_kind_bits == 0x3f800000u || term_kind_bits == 0x40000000u)
      && exact_f32_index_bits(term_index_bits)
      && nonnegative_integer_f32_bits(term_atomic_number_bits)
      && nonnegative_integer_f32_bits_to_u32(term_atomic_number_bits) >= 1u
      && nonnegative_integer_f32_bits_to_u32(term_atomic_number_bits)
        <= MAX_ATOMIC_NUMBER
      && positive_f32_bits(atom_term_authority[row_word_offset + 4u])
      && positive_f32_bits(atom_term_authority[row_word_offset + 5u])
      && term_status_bits == 0x3f800000u;
    let identity_matches =
      atom_residual_evidence[row_word_offset]
        == atom_term_authority[row_word_offset]
      && atom_residual_evidence[row_word_offset + 1u]
        == atom_term_authority[row_word_offset + 3u]
      && atom_residual_evidence[row_word_offset + 5u]
        == atom_term_authority[row_word_offset + 1u]
      && atom_residual_evidence[row_word_offset + 6u]
        == atom_term_authority[row_word_offset + 2u]
      && atom_residual_evidence[row_word_offset + 7u]
        == atom_term_authority[row_word_offset + 7u];
    if (!row_ready || !term_ready || !identity_matches) {
      problem_row_count = problem_row_count + 1u;
      blockers = blockers | BLOCKER_PROBLEM_ROW;
      continue;
    }

    let row_reaction = nonnegative_integer_f32_bits_to_u32(
      row_reaction_bits
    );
    if (has_current_reaction && row_reaction < current_reaction) {
      problem_row_count = problem_row_count + 1u;
      blockers = blockers | BLOCKER_PROBLEM_ROW | BLOCKER_LAYOUT_MISMATCH;
      continue;
    }
    if (!has_current_reaction || row_reaction != current_reaction) {
      if (has_current_reaction) {
        for (var atomic_number = 1u; atomic_number <= MAX_ATOMIC_NUMBER; atomic_number = atomic_number + 1u) {
          let element_residual_bits = atom_residual_bits_by_z[atomic_number];
          if (!finite_f32_bits(element_residual_bits)) {
            blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
          } else {
            max_abs_atom_residual_bits = max(
              max_abs_atom_residual_bits,
              element_residual_bits & 0x7fffffffu
            );
          }
        }
        if (!finite_f32_bits(current_charge_residual_bits)) {
          blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
        } else {
          max_abs_charge_residual_bits = max(
            max_abs_charge_residual_bits,
            current_charge_residual_bits & 0x7fffffffu
          );
        }
      }
      for (var atomic_number = 0u; atomic_number <= MAX_ATOMIC_NUMBER; atomic_number = atomic_number + 1u) {
        atom_residual_bits_by_z[atomic_number] = 0u;
      }
      current_reaction = row_reaction;
      current_charge_residual_bits = 0u;
      has_current_reaction = true;
      seen_reaction_count = seen_reaction_count + 1u;
    }
    ready_row_count = ready_row_count + 1u;
    let atomic_number = nonnegative_integer_f32_bits_to_u32(
      row_atomic_number_bits
    );
    let atom_sum = add_rte_f32_bits(
      atom_residual_bits_by_z[atomic_number],
      atom_residual_evidence[row_word_offset + 2u]
    );
    atom_residual_bits_by_z[atomic_number] = atom_sum.bits;
    if (!atom_sum.finite) {
      blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
    }
    let charge_sum = add_rte_f32_bits(
      current_charge_residual_bits,
      atom_residual_evidence[row_word_offset + 3u]
    );
    current_charge_residual_bits = charge_sum.bits;
    if (!charge_sum.finite) {
      blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
    }
  }

  if (has_current_reaction) {
    for (var atomic_number = 1u; atomic_number <= MAX_ATOMIC_NUMBER; atomic_number = atomic_number + 1u) {
      let element_residual_bits = atom_residual_bits_by_z[atomic_number];
      if (!finite_f32_bits(element_residual_bits)) {
        blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
      } else {
        max_abs_atom_residual_bits = max(
          max_abs_atom_residual_bits,
          element_residual_bits & 0x7fffffffu
        );
      }
    }
    if (!finite_f32_bits(current_charge_residual_bits)) {
      blockers = blockers | BLOCKER_NONFINITE_EVIDENCE;
    } else {
      max_abs_charge_residual_bits = max(
        max_abs_charge_residual_bits,
        current_charge_residual_bits & 0x7fffffffu
      );
    }
  }
  if (seen_reaction_count != params.reaction_count) {
    blockers = blockers | BLOCKER_MISSING_EVIDENCE;
  }

  if (
    finite_f32_bits(params.atom_tolerance_bits)
    && (params.atom_tolerance_bits & 0x80000000u) == 0u
    && max_abs_atom_residual_bits
      > (params.atom_tolerance_bits & 0x7fffffffu)
  ) {
    blockers = blockers | BLOCKER_ATOM_RESIDUAL;
  }
  if (
    finite_f32_bits(params.charge_tolerance_bits)
    && (params.charge_tolerance_bits & 0x80000000u) == 0u
    && max_abs_charge_residual_bits
      > (params.charge_tolerance_bits & 0x7fffffffu)
  ) {
    blockers = blockers | BLOCKER_CHARGE_RESIDUAL;
  }

  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.readyRowCount}u] = ready_row_count;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.problemRowCount}u] = problem_row_count;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.maxAbsAtomResidualMol}u] =
    max_abs_atom_residual_bits;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.maxAbsChargeResidualMol}u] =
    max_abs_charge_residual_bits;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.staticBlockerFlags}u] =
    blockers & STATIC_BLOCKER_MASK;
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.blockerFlags}u] = blockers;

  var terminal_status = STATUS_INITIALIZED | STATUS_FINALIZED;
  if ((blockers & BLOCKER_MISSING_EVIDENCE) == 0u) {
    terminal_status = terminal_status | STATUS_EVIDENCE_COMPLETE;
  }
  if (blockers == 0u) {
    terminal_status = terminal_status | STATUS_PASS;
  } else {
    terminal_status = terminal_status | STATUS_BLOCKED | STATUS_FAIL_CLOSED;
  }
  reaction_strict_gate[${SPH_REACTION_STRICT_GATE_INDEX.statusFlags}u] = terminal_status;
}
`;
