import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

export const SPH_EXACT_REACTION_SPECIES_HEADER_WORDS = 16;
export const SPH_EXACT_REACTION_SPECIES_TERM_FIELDS = Object.freeze([
  'selectedMolesNumerator', 'selectedEntitiesNumerator',
  'survivingMolesNumerator', 'survivingEntitiesNumerator'
]);

/** Numeric layout only. It cannot issue a physical source or product owner. */
export function sphExactReactionSpeciesLayout(format, { termCapacity, elementCapacity } = {}) {
  validateSphExactMassFormat(format);
  for (const [name, value] of Object.entries({ termCapacity, elementCapacity })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) {
      throw new RangeError(`Exact species ${name} must be a positive u32`);
    }
  }
  if (termCapacity < 3 || elementCapacity > 119) throw new RangeError('Invalid exact species capacity');
  const wideWords = 3 * format.wordCount + 26, wideRecordWords = wideWords + 2;
  const headerWords = SPH_EXACT_REACTION_SPECIES_HEADER_WORDS;
  const denominatorOffsetWords = headerWords, avogadroOffsetWords = headerWords + wideRecordWords;
  const termOffsetWords = headerWords + 2 * wideRecordWords;
  const termStrideWords = 16 + 3 * format.wordCount + 4 * wideRecordWords;
  const elementOffsetWords = termOffsetWords + termCapacity * termStrideWords;
  const elementStrideWords = 4 + wideRecordWords;
  const recordWords = elementOffsetWords + elementCapacity * elementStrideWords;
  if (!Number.isSafeInteger(recordWords) || recordWords > 0xffffffff) throw new RangeError('Exact species layout overflow');
  return Object.freeze({ recordWords, headerWords, wideWords, wideRecordWords, termCapacity, elementCapacity,
    denominatorOffsetWords, avogadroOffsetWords, termOffsetWords, termStrideWords,
    elementOffsetWords, elementStrideWords, termFields: SPH_EXACT_REACTION_SPECIES_TERM_FIELDS });
}

/** Composed only into the existing genuine source producer. Requires EM/EE/EC,
 * es_* source helpers, and es_mechanics_bits(index)->vec4<u32> over original M.
 * rule[3] addresses the authenticated metadata block. Explicit term/element
 * capacities and species_record_words must describe the same output layout.
 * Header: ready,error,termCount,elementCount,moleExponent,residualExponent,
 * allResidualsExactlyZero,termCapacity,elementCapacity, then seven zero words.
 * No tolerance or physical-acceptance marker is produced by this pass. */
export function createSphExactReactionSpeciesWgsl(format) {
  validateSphExactMassFormat(format);
  return /* wgsl */ `
fn eq_store_wide(at: u32, value: ExactCaloric) {
  es_output[at] = value.negative; es_output[at + 1u] = value.error;
  for (var i = 0u; i < EC_WORDS; i++) { es_output[at + 2u + i] = value.words[i]; }
}
fn eq_metadata_unsigned(at: u32) -> ExactCaloric {
  var value: ExactCaloric;
  for (var i = 0u; i < EC_WORDS; i++) { value.words[i] = es_metadata[at + i]; }
  return value;
}
fn eq_metadata_signed(at: u32) -> ExactCaloric {
  var value = eq_metadata_unsigned(at + 2u);
  value.negative = es_metadata[at]; value.error = es_metadata[at + 1u]; return value;
}
fn eq_selected_mass(out: u32, term: u32) -> ExactMass {
  if (term < 2u) { return es_load_output(out + 12u + (term + 1u) * EM_WORDS); }
  return es_load_output(out + 12u + 7u * EM_WORDS + (term - 2u) * (4u + 3u * EM_WORDS) + 4u);
}
fn eq_positive_float_bits(bits: u32) -> bool { return bits > 0u && bits < 0x7f800000u; }

@compute @workgroup_size(1)
fn prepare_exact_reaction_species_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words;
  let at = out + es_params.species_offset_words;
  if (es_output[out] != 1u || es_output[out + 1u] != 0u
      || es_output[es_caloric_start(out)] != 1u) { return; }
  let rule = es_output[out + 4u] * 24u; let metadata = es_metadata[rule + 3u];
  let term_count = es_metadata[metadata + 4u]; let element_count = es_metadata[metadata + 5u];
  let term_capacity = es_params.species_term_capacity;
  let wide_stride = EC_WORDS + 2u;
  let term_offset = 16u + 2u * wide_stride;
  let term_stride = 16u + 3u * EM_WORDS + 4u * wide_stride;
  let element_offset = term_offset + term_capacity * term_stride;
  let element_stride = 4u + wide_stride;
  if (es_params.species_record_words < element_offset || term_capacity < 3u) {
    es_output[at + 1u] = ${ERROR.INVALID_RATIO}u; return;
  }
  let element_capacity = es_params.species_element_capacity;
  if (es_metadata[metadata] != 0x4552504du || es_metadata[metadata + 1u] != 1u
      || es_metadata[metadata + 2u] != EM_WORDS || es_metadata[metadata + 3u] != EC_WORDS
      || term_count != es_output[out + 5u] + 2u || term_count > term_capacity
      || element_count == 0u || element_count > element_capacity || element_count > 119u
      || es_metadata[metadata + 7u] != 4u + EC_WORDS
      || es_metadata[metadata + 9u] != 4u || es_metadata[metadata + 11u] != wide_stride
      || es_params.species_record_words != element_offset + element_capacity * element_stride) {
    es_output[at + 1u] = ${ERROR.INVALID_RATIO}u; return;
  }
  let denominator = eq_metadata_unsigned(metadata + es_metadata[metadata + 12u]);
  let avogadro = eq_metadata_unsigned(metadata + es_metadata[metadata + 13u]);
  if (ec_top(denominator) < 0 || ec_top(avogadro) < 0) {
    es_output[at + 1u] = ${ERROR.DIVISION_BY_ZERO}u; return;
  }
  eq_store_wide(at + 16u, denominator); eq_store_wide(at + 16u + wide_stride, avogadro);
  es_output[at + 2u] = term_count; es_output[at + 3u] = element_count;
  es_output[at + 4u] = es_metadata[metadata + 14u];
  es_output[at + 5u] = es_metadata[metadata + 15u];
  es_output[at + 7u] = term_capacity; es_output[at + 8u] = element_capacity;
  var error = 0u;
  for (var term = 0u; term < term_count; term++) {
    let term_metadata = metadata + es_metadata[metadata + 6u] + term * (4u + EC_WORDS);
    let dest = at + term_offset + term * term_stride;
    let kind = select(2u, 1u, term < 2u);
    let mass = eq_selected_mass(out, term);
    let weight = eq_metadata_unsigned(term_metadata + 4u);
    var row_error = 0u;
    if (es_metadata[term_metadata] != kind || ec_top(weight) < 0
        || !eq_positive_float_bits(es_metadata[term_metadata + 3u])) { row_error |= ${ERROR.INVALID_RATIO}u; }
    for (var field = 0u; field < 3u; field++) { es_output[dest + field] = es_metadata[term_metadata + field]; }
    es_output[dest + 4u] = select(1u, 0u, em_zero(mass));
    es_output[dest + 5u] = es_metadata[term_metadata + 3u];
    // Each product has no donor inventory. Reset both values on every term.
    var available = ExactMass(); var survivor = ExactMass();
    if (term < 2u) {
      let row = es_output[out + 2u + term];
      survivor = es_load_output(out + 12u + (term + 3u) * EM_WORDS);
      let sum = em_add(mass, survivor); available = sum.value; row_error |= sum.error;
      let volume = es_mechanics_bits(row * 8u + 4u);
      let phase = es_thermo[row * 3u].y;
      if (em_zero(available) || !eq_positive_float_bits(volume.z) || !eq_positive_float_bits(volume.w)
          || f32(es_metadata[term_metadata + 2u]) != es_thermo[row * 3u].x
          || (phase != 1.0 && phase != 2.0 && phase != 3.0)) { row_error |= ${ERROR.INVALID_RATIO}u; }
      es_output[dest + 3u] = u32(phase); es_output[dest + 7u] = row;
      es_output[dest + 8u] = volume.w; es_output[dest + 9u] = volume.z;
      es_output[dest + 10u] = es_state[row * 2u + 1u].w;
      es_output[dest + 11u] = es_metadata[rule + 22u + term];
    } else {
      let source = out + 12u + 7u * EM_WORDS + (term - 2u) * (4u + 3u * EM_WORDS);
      let state = es_caloric_product_start(out, 2u, term - 2u);
      for (var field = 0u; field < 2u; field++) {
        if (es_metadata[term_metadata + 1u + field] != es_output[source + field]) { row_error |= ${ERROR.INVALID_RATIO}u; }
      }
      if (es_output[source + 3u] != 0u || es_output[state + 7u] != 0u
          || es_output[state + 3u] != select(1u, 0u, em_zero(mass))) { row_error |= ${ERROR.INVALID_RATIO}u; }
      es_output[dest + 3u] = es_output[source + 2u]; es_output[dest + 7u] = 0xffffffffu;
      if (!em_zero(mass)) {
        if (!eq_positive_float_bits(es_output[state + 5u])) { row_error |= ${ERROR.INVALID_FLOAT}u; }
        es_output[dest + 6u] = es_output[state + 5u];
        es_output[dest + 10u] = es_output[state + 4u]; es_output[dest + 11u] = es_output[state + 6u];
      }
    }
    es_output[dest + 13u] = select(1u, 0u, em_zero(survivor));
    es_store(dest + 16u, mass); es_store(dest + 16u + EM_WORDS, available);
    es_store(dest + 16u + 2u * EM_WORDS, survivor);
    let moles = ec_multiply(ec_from_mass(mass), weight);
    let entities = ec_multiply(moles, avogadro);
    let remaining_moles = ec_multiply(ec_from_mass(survivor), weight);
    let remaining_entities = ec_multiply(remaining_moles, avogadro);
    let values = dest + 16u + 3u * EM_WORDS;
    eq_store_wide(values, moles); eq_store_wide(values + wide_stride, entities);
    eq_store_wide(values + 2u * wide_stride, remaining_moles);
    eq_store_wide(values + 3u * wide_stride, remaining_entities);
    row_error |= moles.error | entities.error | remaining_moles.error | remaining_entities.error;
    es_output[dest + 12u] = row_error; error |= row_error;
  }
  var all_zero = 1u; var previous_z = 0u;
  for (var element = 0u; element < element_count; element++) {
    let descriptor = metadata + es_metadata[metadata + 8u] + element * 4u;
    // Each element (including charge) starts its own signed balance.
    let z = es_metadata[descriptor]; var residual = ExactCaloric();
    if ((element == 0u && z != 0u) || (element != 0u && z <= previous_z) || z > 118u) {
      residual = ec_failure(${ERROR.INVALID_RATIO}u);
    }
    previous_z = z;
    for (var term = 0u; term < term_count; term++) {
      let weight = eq_metadata_signed(metadata + es_metadata[descriptor + 1u] + term * wide_stride);
      let contribution = ec_multiply(ec_from_mass(eq_selected_mass(out, term)), weight);
      if (term < 2u) { residual = ec_subtract(residual, contribution); }
      else { residual = ec_add(residual, contribution); }
    }
    let dest = at + element_offset + element * element_stride;
    let exact_zero = select(0u, 1u, residual.error == 0u && ec_top(residual) < 0);
    es_output[dest] = z; es_output[dest + 1u] = residual.error; es_output[dest + 2u] = exact_zero;
    eq_store_wide(dest + 4u, residual); all_zero &= exact_zero; error |= residual.error;
  }
  es_output[at + 1u] = error; es_output[at + 6u] = select(0u, all_zero, error == 0u);
  es_output[at] = select(0u, 1u, error == 0u);
}
`;
}
