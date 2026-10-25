import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';

export const SPH_EXACT_REACTION_ROUTING_HEADER_WORDS = 16;
export const SPH_EXACT_REACTION_ROUTING_KIND = Object.freeze({ EMPTY: 0, SURVIVOR: 1, PRODUCT: 2 });

/** Numeric candidate layout. Parent references require the original retained
 * source owner; this descriptor cannot issue physical inventory ownership.
 * Header: prepared,error,pairRow,peer,reaction,products,freeMask,directMask,
 * physicalAccepted(always zero), then seven zero words.
 * Endpoint: kind,destination,pairRow,speciesOrdinal,globalTerm,material,active,0,mass[N].
 * Residual: pairRow,speciesOrdinal,globalTerm,material,active,0,0,0,mass[N].
 * Only endpoint/residual masses are routed inventory. The referenced packet is
 * an immutable quantity basis, not another copy of the routed mass ledger.
 */
export function sphExactReactionRoutingLayout(format, { productCapacity } = {}) {
  validateSphExactMassFormat(format);
  if (!Number.isSafeInteger(productCapacity) || productCapacity < 1 || productCapacity > 0xffffffff) {
    throw new RangeError('Exact routing product capacity must be a positive u32');
  }
  const headerWords = SPH_EXACT_REACTION_ROUTING_HEADER_WORDS;
  const endpointStrideWords = 8 + format.wordCount, endpointOffsetWords = headerWords;
  const residualOffsetWords = endpointOffsetWords + 2 * endpointStrideWords;
  const residualStrideWords = endpointStrideWords;
  const recordWords = residualOffsetWords + productCapacity * residualStrideWords;
  if (!Number.isSafeInteger(recordWords) || recordWords > 0xffffffff) throw new RangeError('Exact routing layout overflow');
  return Object.freeze({ recordWords, headerWords, endpointOffsetWords, endpointStrideWords,
    endpointCount: 2, residualOffsetWords, residualStrideWords, productCapacity, massWordCount: format.wordCount });
}

/** Consumes the genuine producer's selected packet. Every output remains
 * speculative: no accepted-pair marker, f32 mass reconstruction, or species
 * tolerance admission is performed. Parent retention is the caller's duty.
 */
export function createSphExactReactionRoutingWgsl(format) {
  validateSphExactMassFormat(format);
  return createSphExactMassWgsl(format) + /* wgsl */ `
struct ExactRoutingParams {
  particle_count: u32, source_record_words: u32, route_record_words: u32, product_capacity: u32,
  caloric_offset: u32, energy_offset: u32, species_offset: u32, species_term_offset: u32,
  species_term_stride: u32, reaction_count: u32, reserved0: u32, reserved1: u32,
  reserved2: u32, reserved3: u32, reserved4: u32, reserved5: u32
}
@group(0) @binding(0) var<storage, read> rt_source: array<u32>;
@group(0) @binding(1) var<storage, read> rt_order: array<u32>;
@group(0) @binding(2) var<storage, read_write> rt_output: array<u32>;
@group(0) @binding(3) var<uniform> rt_params: ExactRoutingParams;
const RT_INVALID: u32 = ${ERROR.INVALID_RATIO}u;
fn rt_mass(at: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = rt_source[at + i]; }
  return value;
}
fn rt_store_mass(at: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { rt_output[at + i] = value.words[i]; }
}
fn rt_product(at: u32, local: u32) -> u32 { return at + 12u + 7u * EM_WORDS + local * (4u + 3u * EM_WORDS); }
fn rt_term(at: u32, ordinal: u32) -> u32 {
  return at + rt_params.species_offset + rt_params.species_term_offset + ordinal * rt_params.species_term_stride;
}
fn rt_same(a: ExactMass, b: ExactMass) -> bool { return em_compare(a, b) == 0; }
fn rt_range(offset: u32, count: u32) -> bool {
  return offset <= rt_params.source_record_words && count <= rt_params.source_record_words - offset;
}

@compute @workgroup_size(1)
fn prepare_exact_reaction_endpoint_routes(@builtin(global_invocation_id) id: vec3<u32>) {
  let pair = id.x;
  if (pair >= rt_params.particle_count || rt_params.route_record_words < 16u
      || pair >= arrayLength(&rt_output) / rt_params.route_record_words) { return; }
  let out = pair * rt_params.route_record_words;
  // Clear independently of allocation/reuse policy. Failure never exposes a
  // partial pair, and inactive rows remain entirely zero.
  for (var i = 0u; i < rt_params.route_record_words; i++) { rt_output[out + i] = 0u; }
  let row_stride = 8u + EM_WORDS;
  let wide_stride = 3u * EM_WORDS + 28u;
  if (rt_params.source_record_words < 12u || rt_params.product_capacity == 0u
      || pair >= arrayLength(&rt_source) / rt_params.source_record_words
      || rt_params.product_capacity > (rt_params.route_record_words - 16u) / row_stride
      || rt_params.route_record_words != 16u + (rt_params.product_capacity + 2u) * row_stride
      || rt_params.species_term_offset != 16u + 2u * wide_stride
      || rt_params.species_term_stride != 16u + 3u * EM_WORDS + 4u * wide_stride
      || !rt_range(rt_params.caloric_offset, 16u) || !rt_range(rt_params.energy_offset, 8u)
      || !rt_range(rt_params.species_offset, 16u)
      || (rt_params.reserved0 | rt_params.reserved1 | rt_params.reserved2
        | rt_params.reserved3 | rt_params.reserved4 | rt_params.reserved5) != 0u) {
    rt_output[out + 1u] = RT_INVALID; return;
  }
  let src = pair * rt_params.source_record_words;
  // A zero-cap/infeasible debit choice can retain diagnostic identities and
  // original remainders. Its original selection marker, not payload zeroing,
  // distinguishes an inactive pair from a selected pair whose later solve failed.
  if (rt_source[src] == 0u && rt_source[src + 1u] == 0u) { return; }
  let caloric = src + rt_params.caloric_offset;
  let energy = src + rt_params.energy_offset;
  let species = src + rt_params.species_offset;
  let source_error = rt_source[src + 1u] | rt_source[caloric + 1u]
    | rt_source[energy + 1u] | rt_source[species + 1u];
  if (source_error != 0u || rt_source[src] != 1u || rt_source[caloric] != 1u
      || rt_source[energy] != 1u || rt_source[species] != 1u || rt_source[src + 11u] != 0u) {
    rt_output[out + 1u] = select(RT_INVALID, source_error, source_error != 0u); return;
  }
  let donor_a = rt_source[src + 2u]; let donor_b = rt_source[src + 3u];
  let peer = max(donor_a, donor_b); let reaction = rt_source[src + 4u];
  let count = rt_source[src + 5u]; let order_stride = rt_params.product_capacity + 1u;
  if (donor_a == donor_b || min(donor_a, donor_b) != pair || peer >= rt_params.particle_count
      || reaction >= rt_params.reaction_count || reaction >= arrayLength(&rt_order) / order_stride
      || count == 0u || count > rt_params.product_capacity
      || rt_source[species + 2u] != count + 2u
      || rt_source[species + 7u] != rt_params.product_capacity + 2u
      || !rt_range(12u, 7u * EM_WORDS + count * (4u + 3u * EM_WORDS))
      || rt_params.species_term_offset > rt_params.source_record_words - rt_params.species_offset
      || count + 2u > (rt_params.source_record_words - rt_params.species_offset - rt_params.species_term_offset)
        / rt_params.species_term_stride) {
    rt_output[out + 1u] = RT_INVALID; return;
  }
  let order = reaction * order_stride;
  if (rt_order[order] != count) { rt_output[out + 1u] = RT_INVALID; return; }
  for (var i = 0u; i < rt_params.product_capacity; i++) {
    let ordinal = rt_order[order + 1u + i];
    if (i >= count) {
      if (ordinal != 0xffffffffu) { rt_output[out + 1u] = RT_INVALID; return; }
    } else {
      if (ordinal >= count) { rt_output[out + 1u] = RT_INVALID; return; }
      for (var j = 0u; j < i; j++) {
        if (ordinal == rt_order[order + 1u + j]) { rt_output[out + 1u] = RT_INVALID; return; }
      }
    }
  }
  let total = rt_mass(src + 12u);
  var error = 0u;
  var debit_sum = ExactMass();
  var available_sum = ExactMass();
  var endpoint_mass = array<ExactMass, 2>();
  var endpoint_kind = array<u32, 2>(0u, 0u);
  var endpoint_ordinal = array<u32, 2>(0xffffffffu, 0xffffffffu);
  var free_mask = 0u; var direct_mask = 0u;
  for (var donor = 0u; donor < 2u; donor++) {
    let term = rt_term(src, donor); let row = rt_source[src + 2u + donor];
    let slot = select(1u, 0u, row == pair);
    let debit = rt_mass(src + 12u + (donor + 1u) * EM_WORDS);
    let survivor = rt_mass(src + 12u + (donor + 3u) * EM_WORDS);
    let available = em_add(debit, survivor); let sum = em_add(debit_sum, debit);
    let combined_available = em_add(available_sum, available.value); available_sum = combined_available.value;
    error |= available.error | sum.error | combined_available.error | rt_source[term + 12u]; debit_sum = sum.value;
    if (em_zero(debit) || rt_source[term] != 1u || rt_source[term + 2u] == 0u
        || rt_source[term + 7u] != row || rt_source[term + 4u] != 1u
        || rt_source[term + 13u] != select(1u, 0u, em_zero(survivor))
        || !rt_same(rt_mass(term + 16u), debit)
        || !rt_same(rt_mass(term + 16u + EM_WORDS), available.value)
        || !rt_same(rt_mass(term + 16u + 2u * EM_WORDS), survivor)) { error |= RT_INVALID; }
    if (em_zero(survivor)) { free_mask |= 1u << slot; }
    else { endpoint_mass[slot] = survivor; endpoint_kind[slot] = 1u; endpoint_ordinal[slot] = donor; }
  }
  if (em_zero(total) || !rt_same(total, debit_sum)) { error |= RT_INVALID; }
  var product_sum = ExactMass();
  for (var local = 0u; local < count; local++) {
    let product = rt_product(src, local); let term = rt_term(src, local + 2u);
    let mass = rt_mass(product + 4u);
    let provenance_sum = em_add(rt_mass(product + 4u + EM_WORDS), rt_mass(product + 4u + 2u * EM_WORDS));
    let sum = em_add(product_sum, mass); product_sum = sum.value;
    error |= sum.error | provenance_sum.error | rt_source[product + 3u] | rt_source[term + 12u];
    if (rt_source[term] != 2u || rt_source[term + 1u] != rt_source[product]
        || rt_source[term + 2u] != rt_source[product + 1u] || rt_source[term + 2u] == 0u
        || rt_source[term + 3u] != rt_source[product + 2u]
        || rt_source[term + 7u] != 0xffffffffu || rt_source[term + 13u] != 0u
        || rt_source[term + 4u] != select(1u, 0u, em_zero(mass))
        || !rt_same(rt_mass(term + 16u), mass) || !rt_same(provenance_sum.value, mass)
        || !em_zero(rt_mass(term + 16u + EM_WORDS)) || !em_zero(rt_mass(term + 16u + 2u * EM_WORDS))) {
      error |= RT_INVALID;
    }
    for (var previous = 0u; previous < local; previous++) {
      if (rt_source[rt_product(src, previous)] == rt_source[product]) { error |= RT_INVALID; }
    }
  }
  if (!rt_same(total, product_sum)) { error |= RT_INVALID; }
  var next_choice = 0u;
  for (var slot = 0u; slot < 2u; slot++) {
    if ((free_mask & (1u << slot)) == 0u) { continue; }
    if (count == 1u && free_mask == 3u) {
      let donor = select(1u, 0u, (slot == 0u && donor_a == pair) || (slot == 1u && donor_a == peer));
      endpoint_mass[slot] = rt_mass(src + 12u + (donor + 1u) * EM_WORDS);
      endpoint_kind[slot] = 2u; endpoint_ordinal[slot] = 2u; direct_mask |= 1u << slot;
    } else {
      loop {
        if (next_choice >= count) { break; }
        let local = rt_order[order + 1u + next_choice]; next_choice++;
        let mass = rt_mass(rt_product(src, local) + 4u);
        if (em_zero(mass)) { continue; }
        endpoint_mass[slot] = mass; endpoint_kind[slot] = 2u;
        endpoint_ordinal[slot] = local + 2u; direct_mask |= 1u << slot; break;
      }
    }
  }
  // Validate every debit before storing either endpoint or any fragment.
  let endpoint_sum = em_add(endpoint_mass[0u], endpoint_mass[1u]);
  var routed_sum = endpoint_sum.value; error |= endpoint_sum.error;
  for (var local = 0u; local < count; local++) {
    var direct = ExactMass();
    for (var slot = 0u; slot < 2u; slot++) {
      if (endpoint_kind[slot] == 2u && endpoint_ordinal[slot] == local + 2u) {
        let sum = em_add(direct, endpoint_mass[slot]); direct = sum.value; error |= sum.error;
      }
    }
    let mass = rt_mass(rt_product(src, local) + 4u);
    let residual = em_subtract(mass, direct); let restored = em_add(direct, residual.value);
    let combined_routed = em_add(routed_sum, residual.value); routed_sum = combined_routed.value;
    error |= residual.error | restored.error | combined_routed.error;
    if (!rt_same(restored.value, mass)) { error |= RT_INVALID; }
  }
  if (!rt_same(routed_sum, available_sum)) { error |= RT_INVALID; }
  if (error != 0u) { rt_output[out + 1u] = error; return; }
  for (var slot = 0u; slot < 2u; slot++) {
    let dest = out + 16u + slot * row_stride;
    rt_output[dest] = endpoint_kind[slot]; rt_output[dest + 1u] = select(pair, peer, slot == 1u);
    rt_output[dest + 2u] = pair; rt_output[dest + 3u] = endpoint_ordinal[slot];
    rt_output[dest + 4u] = 0xffffffffu;
    if (endpoint_kind[slot] != 0u) {
      let term = rt_term(src, endpoint_ordinal[slot]);
      rt_output[dest + 4u] = rt_source[term + 1u]; rt_output[dest + 5u] = rt_source[term + 2u];
      rt_output[dest + 6u] = 1u; rt_store_mass(dest + 8u, endpoint_mass[slot]);
    }
  }
  for (var local = 0u; local < count; local++) {
    var direct = ExactMass();
    for (var slot = 0u; slot < 2u; slot++) {
      if (endpoint_kind[slot] == 2u && endpoint_ordinal[slot] == local + 2u) {
        direct = em_add(direct, endpoint_mass[slot]).value;
      }
    }
    let term = rt_term(src, local + 2u);
    let residual = em_subtract(rt_mass(rt_product(src, local) + 4u), direct).value;
    let dest = out + 16u + (2u + local) * row_stride;
    rt_output[dest] = pair; rt_output[dest + 1u] = local + 2u;
    rt_output[dest + 2u] = rt_source[term + 1u]; rt_output[dest + 3u] = rt_source[term + 2u];
    rt_output[dest + 4u] = select(1u, 0u, em_zero(residual)); rt_store_mass(dest + 8u, residual);
  }
  rt_output[out + 2u] = pair; rt_output[out + 3u] = peer; rt_output[out + 4u] = reaction;
  rt_output[out + 5u] = count; rt_output[out + 6u] = free_mask; rt_output[out + 7u] = direct_mask;
  // PREPARED follows the complete partition. Header[8] stays zero even when
  // exact species residuals are nonzero; routing never spends a tolerance.
  rt_output[out] = 1u;
}
`;
}
