import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphGasConstitutiveWgsl } from '../../../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';
import { SPH_GAS_CONSTITUTIVE_SCHEMA } from '../../../ulg-gpu-abi/src/sphGasConstitutive.js';
import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactExtensiveWgsl } from './sphExactExtensiveWgsl.js';
import { createSphExactCaloricWgsl } from './sphExactCaloricWgsl.js';
import { createSphExactRationalProjectionWgsl } from './sphExactRationalProjectionWgsl.js';

const u32 = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`Invalid exact output ${name}`);
  return value;
};
const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];

/** Physical ABI staging only; no placement or physical inventory owner is
 * issued. Event selected/direct masses are provenance, not spendable copies.
 * Pair header16: ready,error,pair,peer,reaction,products,physicalAccepted(0),
 * projectionFlags, then zeros. Carrier8+N: kind,sourceRow,pair,speciesOrdinal,
 * globalTerm,material,active,0,mass. Kinds: original0,survivor1,product2,empty3.
 * Event8+3N: pair,globalTerm,speciesOrdinal,material,active,ready,error,0,
 * selected[N],direct[N],residual[N]. Only carrier+residual masses count.
 */
export function sphExactReactionOutputLayout(format, { particleCount, productCapacity } = {}) {
  validateSphExactMassFormat(format);
  u32(particleCount, 'particle count'); u32(productCapacity, 'product capacity');
  if (!particleCount || !productCapacity) throw new RangeError('Positive exact output capacities required');
  const carrierOffsetWords = particleCount * 16, carrierStrideWords = 8 + format.wordCount;
  const eventCompanionOffsetWords = Math.ceil((carrierOffsetWords + particleCount * carrierStrideWords) / 64) * 64;
  const eventCompanionStrideWords = 8 + 3 * format.wordCount, denseEventCount = particleCount * productCapacity;
  const auxWords = eventCompanionOffsetWords + denseEventCount * eventCompanionStrideWords;
  for (const [name, value] of Object.entries({ carrierOffsetWords, eventCompanionOffsetWords, denseEventCount, auxWords,
    packedWords: particleCount * 52, denseEventWords: denseEventCount * 32 })) u32(value, name);
  return Object.freeze({ particleCount, productCapacity, pairHeaderWords: 16, pairHeaderOffsetWords: 0,
    carrierOffsetWords, carrierStrideWords, eventCompanionOffsetWords, eventCompanionStrideWords,
    auxWords, packedParticleWords: 52, eventWords: 32, denseEventCount, massWordCount: format.wordCount });
}

/** Original cold term/phase/gas records only. Revalidation surrounds encoding;
 * this numeric copy cannot register a GPU source or authorize publication. */
export function encodeSphExactReactionOutputMetadata(compiled, { reactionTable, thermalMaterialTable } = {}) {
  if (!Array.isArray(compiled) || !compiled.length || compiled.length !== reactionTable?.reactionCount) {
    throw new TypeError('Original complete exact reaction compilations required');
  }
  const validate = () => compiled.forEach((token, reactionIndex) => resolveSphExactReactionAllocation(token,
    { reactionTable, thermalMaterialTable, reactionIndex }));
  validate();
  const termCount = u32(reactionTable.productTermCount, 'metadata term count'), termStrideWords = 24;
  if (reactionTable.productTermStrideFloats !== 16 || reactionTable.productPhaseStrideFloats !== 12
      || reactionTable.gasConstitutiveSchema !== SPH_GAS_CONSTITUTIVE_SCHEMA) {
    throw new TypeError('Original product phase and gas ABI required');
  }
  const words = new Uint32Array(u32(termCount * termStrideWords, 'metadata size'));
  const seen = new Set();
  for (const token of compiled) for (const term of token.products) {
    if (term.termIndex >= termCount || seen.has(term.termIndex)) throw new TypeError('Duplicate exact product identity');
    seen.add(term.termIndex);
    const source = term.termIndex * 16, records = reactionTable.productTermRecords;
    if (records[source] !== token.reactionIndex || records[source + 1] !== term.materialId
        || records[source + 7] !== 1) throw new TypeError('Changed exact product term');
    let phase = -1;
    for (let i = 0; i < reactionTable.productPhaseCount; i++) {
      const offset = i * 12;
      if (reactionTable.productPhaseRecords[offset] === term.materialId
          && reactionTable.productPhaseRecords[offset + 1] === term.targetPhase) { phase = i; break; }
    }
    if (phase < 0 || reactionTable.productPhaseRecords[phase * 12 + 9] !== 1
        || reactionTable.gasConstitutiveRecords.length < (phase + 1) * 4) {
      throw new TypeError('Original product mechanics unavailable');
    }
    const at = term.termIndex * termStrideWords;
    words.set([token.reactionIndex, term.termIndex, term.materialId, term.targetPhase,
      bits(records[source + 2]), bits(records[source + 3]), bits(records[source + 5]), 1], at);
    for (let i = 0; i < 12; i++) words[at + 8 + i] = bits(reactionTable.productPhaseRecords[phase * 12 + i]);
    for (let i = 0; i < 4; i++) words[at + 20 + i] = bits(reactionTable.gasConstitutiveRecords[phase * 4 + i]);
  }
  if (seen.size !== termCount) throw new TypeError('Incomplete exact product metadata');
  validate();
  return Object.freeze({ words, termCount, termStrideWords });
}

export function createSphExactReactionOutputParams({ selected, routingLayout, layout, inventoryRowOffset, metadata }) {
  validateSphExactMassFormat(selected.format);
  const n = selected.format.wordCount;
  if (layout.particleCount !== selected.particleCount || layout.productCapacity !== selected.caloricProductCapacity
      || routingLayout.productCapacity !== layout.productCapacity || layout.massWordCount !== n
      || metadata.termStrideWords !== 24) throw new TypeError('Mismatched exact output descriptors');
  const fields = [selected.particleCount, selected.recordWords, routingLayout.recordWords, layout.productCapacity,
    u32(inventoryRowOffset, 'inventory row offset') * n, selected.caloricOffsetWords, selected.caloricProductOffsetWords,
    selected.extensiveOffsetWords, selected.speciesOffsetWords, selected.speciesLayout.termOffsetWords,
    selected.speciesLayout.termStrideWords, selected.productEnergyOffsetWords, layout.carrierOffsetWords,
    layout.carrierStrideWords, layout.eventCompanionOffsetWords, layout.eventCompanionStrideWords,
    metadata.termCount, layout.auxWords, 0, 0];
  fields.forEach((value, index) => u32(value, `parameter ${index}`));
  return new Uint32Array(fields);
}

export function createSphExactReactionOutputWgsl(format) {
  validateSphExactMassFormat(format);
  const na = 602214076000000000000000n;
  const naWords = Array.from({ length: 3 }, (_, i) => Number((na >> BigInt(i * 32)) & 0xffffffffn));
  return createSphExactMassWgsl(format) + createSphExactExtensiveWgsl(format)
    + createSphExactCaloricWgsl(format) + createSphExactRationalProjectionWgsl(format)
    + sphGasConstitutiveWgsl + /* wgsl */ `
struct ExactOutputParams {
  count: u32, source_words: u32, route_words: u32, product_capacity: u32,
  inventory_offset: u32, caloric_offset: u32, caloric_product_offset: u32, extensive_offset: u32,
  species_offset: u32, species_term_offset: u32, species_term_stride: u32, energy_offset: u32,
  carrier_offset: u32, carrier_stride: u32, event_offset: u32, event_stride: u32,
  metadata_terms: u32, aux_words: u32, reserved0: u32, reserved1: u32
}
@group(0) @binding(0) var<storage, read> eo_original: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read> eo_packet: array<u32>;
@group(0) @binding(2) var<storage, read> eo_routes: array<u32>;
@group(0) @binding(3) var<storage, read> eo_metadata: array<u32>;
@group(0) @binding(4) var<storage, read> eo_inventory: array<u32>;
@group(0) @binding(5) var<storage, read_write> eo_particles: array<vec4<u32>>;
@group(0) @binding(6) var<storage, read_write> eo_events: array<vec4<u32>>;
@group(0) @binding(7) var<storage, read_write> eo_aux: array<u32>;
@group(0) @binding(8) var<uniform> eo_params: ExactOutputParams;
const EO_INVALID: u32 = ${ERROR.INVALID_RATIO}u;
fn eo_finite(bits: u32) -> bool { return (bits & 0x7f800000u) != 0x7f800000u; }
fn eo_positive(bits: u32) -> bool { return bits > 0u && bits < 0x7f800000u; }
fn eo_scalar(value: u32) -> ExactCaloric { var result = ExactCaloric(); result.words[0] = value; return result; }
fn eo_packet_mass(at: u32) -> ExactMass {
  var value = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = eo_packet[at + i]; } return value;
}
fn eo_route_mass(at: u32) -> ExactMass {
  var value = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = eo_routes[at + i]; } return value;
}
fn eo_original_mass(row: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = eo_inventory[eo_params.inventory_offset + row * EM_WORDS + i]; }
  return value;
}
fn eo_store_mass(at: u32, mass: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { eo_aux[at + i] = mass.words[i]; }
}
fn eo_species(src: u32, ordinal: u32) -> u32 {
  return src + eo_params.species_offset + eo_params.species_term_offset + ordinal * eo_params.species_term_stride;
}
fn eo_index(value: u32) -> ExactMassProjection {
  let projected = f32(value);
  if (projected >= 4294967296.0 || u32(projected) != value) { return ExactMassProjection(0u, EO_INVALID); }
  return ExactMassProjection(bitcast<u32>(projected), 0u);
}
fn eo_required(value: ExactMassProjection) -> ExactMassProjection {
  if (value.error != 0u) { return value; }
  if (!eo_positive(value.bits)) { return ExactMassProjection(value.bits, value.error | ${ERROR.PROJECTION_UNDERFLOW}u); }
  return value;
}
// Integer mass / admitted positive f32 denominator. Entity count uses exact SI
// NA, never the rounded legacy constant or rounded mass/moles projection.
fn eo_quantity(mass: ExactMass, denominator_bits: u32, entities: bool) -> ExactMassProjection {
  if (!eo_positive(denominator_bits)) { return ExactMassProjection(0u, ${ERROR.INVALID_FLOAT}u); }
  let encoded = (denominator_bits >> 23u) & 255u;
  let coefficient = (denominator_bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  let exponent = select(-149, i32(encoded) - 150, encoded != 0u);
  var numerator = ec_from_mass(mass);
  if (entities) {
    var avogadro = ExactCaloric();
    avogadro.words[0] = ${naWords[0]}u; avogadro.words[1] = ${naWords[1]}u; avogadro.words[2] = ${naWords[2]}u;
    numerator = ec_multiply(numerator, avogadro);
  }
  return er_project_f32_bits(numerator, eo_scalar(coefficient), EM_QUANTUM - exponent);
}
fn eo_scaled_fraction(mass: ExactMass, original_bits: u32, available: ExactMass) -> ExactMassProjection {
  return er_project_f32_bits(ec_from_extensive(ee_mass_scaled(mass, original_bits)), ec_from_mass(available), -299);
}
struct ExactOutputSupport { numerator: ExactCaloric, denominator: ExactCaloric, error: u32 }
fn eo_consumed_support(src: u32) -> ExactOutputSupport {
  let a = eo_packet[src + 2u]; let b = eo_packet[src + 3u];
  let va = eo_original[a * 13u + 9u]; let vb = eo_original[b * 13u + 9u];
  let ma = eo_original_mass(a); let mb = eo_original_mass(b);
  let ca = eo_packet_mass(src + 12u + EM_WORDS); let cb = eo_packet_mass(src + 12u + 2u * EM_WORDS);
  let first = ec_from_extensive(ee_mass_product(ca, va.z, va.w, false));
  let second = ec_from_extensive(ee_mass_product(cb, vb.z, vb.w, false));
  let numerator = ec_add(ec_multiply(first, ec_from_mass(mb)), ec_multiply(second, ec_from_mass(ma)));
  let denominator = ec_multiply(ec_from_mass(ma), ec_from_mass(mb));
  var error = numerator.error | denominator.error;
  if (!eo_positive(va.z) || !eo_positive(va.w) || !eo_positive(vb.z) || !eo_positive(vb.w)
      || numerator.negative != 0u || ec_top(numerator) < 0 || ec_top(denominator) < 0) { error |= EO_INVALID; }
  return ExactOutputSupport(numerator, denominator, error);
}
fn eo_support_fragment(support: ExactOutputSupport, mass: ExactMass, total: ExactMass) -> ExactMassProjection {
  if (support.error != 0u) { return ExactMassProjection(0u, support.error); }
  return er_project_f32_bits(ec_multiply(support.numerator, ec_from_mass(mass)),
    ec_multiply(support.denominator, ec_from_mass(total)), -299);
}
fn eo_restore(row: u32) {
  for (var i = 0u; i < 13u; i++) { eo_particles[row * 13u + i] = eo_original[row * 13u + i]; }
  let at = eo_params.carrier_offset + row * eo_params.carrier_stride;
  for (var i = 0u; i < eo_params.carrier_stride; i++) { eo_aux[at + i] = 0u; }
  let mass = eo_original_mass(row);
  eo_aux[at + 1u] = row; eo_aux[at + 2u] = 0xffffffffu; eo_aux[at + 3u] = 0xffffffffu;
  eo_aux[at + 4u] = 0xffffffffu; eo_aux[at + 5u] = u32(bitcast<f32>(eo_original[row * 13u + 2u].x));
  eo_aux[at + 6u] = select(1u, 0u, em_zero(mass)); eo_store_mass(at + 8u, mass);
}
fn eo_clear_pair_events(pair: u32) {
  for (var local = 0u; local < eo_params.product_capacity; local++) {
    let event = pair * eo_params.product_capacity + local;
    for (var i = 0u; i < 8u; i++) { eo_events[event * 8u + i] = vec4<u32>(0u); }
    let at = eo_params.event_offset + event * eo_params.event_stride;
    for (var i = 0u; i < eo_params.event_stride; i++) { eo_aux[at + i] = 0u; }
  }
}
fn eo_reject(pair: u32, peer: u32, error: u32) {
  eo_restore(pair); eo_restore(peer); eo_clear_pair_events(pair);
  for (var i = 0u; i < 16u; i++) { eo_aux[pair * 16u + i] = 0u; }
  eo_aux[pair * 16u + 1u] = select(EO_INVALID, error, error != 0u);
}
@compute @workgroup_size(1)
fn initialize_exact_reaction_outputs(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= eo_params.count) { return; }
  for (var i = 0u; i < 16u; i++) { eo_aux[id.x * 16u + i] = 0u; }
  eo_restore(id.x); eo_clear_pair_events(id.x);
  if (id.x == 0u) {
    for (var i = eo_params.carrier_offset + eo_params.count * eo_params.carrier_stride;
      i < eo_params.event_offset; i++) { eo_aux[i] = 0u; }
  }
}
struct ExactOutputProduct {
  material: u32, phase: u32, temperature: u32, u_bits: u32, rho: u32,
  bulk: u32, shear: u32, lambda: u32, sound: u32, eos: u32, solid: u32,
  coefficient: u32, molar: u32, routing: u32, error: u32
}
fn eo_product_state(src: u32, local: u32) -> ExactOutputProduct {
  var value = ExactOutputProduct();
  let term = src + 12u + 7u * EM_WORDS + local * (4u + 3u * EM_WORDS);
  let global_term = eo_packet[term];
  if (global_term >= eo_params.metadata_terms) { value.error = EO_INVALID; return value; }
  let cold = global_term * 24u;
  let state = src + eo_params.caloric_offset + eo_params.caloric_product_offset
    + (2u * eo_params.product_capacity + local) * 8u;
  let species = eo_species(src, local + 2u);
  let material = eo_index(eo_packet[term + 1u]); let phase = eo_index(eo_packet[term + 2u]);
  value.error = material.error | phase.error | eo_packet[term + 3u] | eo_packet[state + 7u];
  value.material = material.bits; value.phase = phase.bits;
  value.temperature = eo_packet[src + eo_params.caloric_offset + 4u];
  value.u_bits = eo_packet[state + 4u]; value.rho = eo_packet[state + 5u];
  value.coefficient = eo_metadata[cold + 4u]; value.molar = eo_metadata[cold + 5u];
  value.routing = eo_metadata[cold + 6u];
  if (eo_metadata[cold] != eo_packet[src + 4u] || eo_metadata[cold + 1u] != global_term
      || eo_metadata[cold + 2u] != eo_packet[term + 1u] || eo_metadata[cold + 3u] != eo_packet[term + 2u]
      || eo_metadata[cold + 7u] != 1u || eo_packet[state + 3u] != 1u
      || eo_packet[state] != global_term || eo_packet[state + 1u] != eo_packet[term + 1u]
      || eo_packet[state + 2u] != eo_packet[term + 2u] || eo_packet[species + 5u] != value.molar
      || eo_metadata[cold + 8u] != material.bits || eo_metadata[cold + 9u] != phase.bits
      || eo_metadata[cold + 17u] != 0x3f800000u || eo_packet[term + 2u] < 1u || eo_packet[term + 2u] > 3u
      || !eo_positive(value.temperature) || !eo_positive(value.rho) || !eo_finite(value.u_bits)
      || !eo_positive(value.coefficient) || !eo_positive(value.molar) || !eo_finite(value.routing)) {
    value.error |= EO_INVALID;
  }
  value.bulk = eo_metadata[cold + 11u]; value.shear = eo_metadata[cold + 12u];
  value.lambda = eo_metadata[cold + 13u]; value.sound = eo_metadata[cold + 14u];
  value.eos = eo_metadata[cold + 15u]; value.solid = eo_metadata[cold + 16u];
  if (value.eos == 0x40000000u) {
    let law = bitcast<vec4<f32>>(vec4<u32>(eo_metadata[cold + 20u], eo_metadata[cold + 21u],
      eo_metadata[cold + 22u], eo_metadata[cold + 23u]));
    value.sound = bitcast<u32>(gas_constitutive_sound_speed(law, bitcast<f32>(value.temperature)));
  }
  if (!eo_finite(value.bulk) || !eo_finite(value.shear) || !eo_finite(value.lambda)
      || !eo_finite(value.sound) || (value.sound >> 31u) != 0u
      || !eo_finite(value.eos) || !eo_finite(value.solid)) { value.error |= ${ERROR.INVALID_FLOAT}u; }
  return value;
}
fn eo_stage_endpoint(pair: u32, src: u32, route: u32, slot: u32,
  support: ExactOutputSupport, total: ExactMass) -> u32 {
  let descriptor = route + 16u + slot * (8u + EM_WORDS);
  let kind = eo_routes[descriptor]; let row = eo_routes[descriptor + 1u];
  let ordinal = eo_routes[descriptor + 3u]; let mass = eo_route_mass(descriptor + 8u);
  if (row >= eo_params.count || eo_routes[descriptor + 2u] != pair || kind > 2u
      || (kind == 0u) != em_zero(mass)) { return EO_INVALID; }
  let packed = row * 13u; let carrier = eo_params.carrier_offset + row * eo_params.carrier_stride;
  var error = 0u;
  if (kind == 0u) {
    eo_particles[packed].w = 0u; eo_particles[packed + 4u].y = 0u;
    eo_particles[packed + 9u].w = 0u; eo_particles[packed + 12u].w = 0u;
  } else {
    let projected_mass = eo_required(em_project_f32_bits(mass)); error |= projected_mass.error;
    if (kind == 1u) {
      if (ordinal >= 2u || eo_packet[src + 2u + ordinal] != row) { return EO_INVALID; }
      let term = eo_species(src, ordinal); let available = eo_original_mass(row);
      if (em_compare(available, eo_packet_mass(term + 16u + EM_WORDS)) != 0
          || em_compare(mass, eo_packet_mass(term + 16u + 2u * EM_WORDS)) != 0) { return EO_INVALID; }
      let entities = eo_required(eo_quantity(mass, eo_packet[term + 5u], true));
      let rest_volume = eo_required(eo_scaled_fraction(mass, eo_original[packed + 9u].w, available));
      let current_volume = eo_required(er_project_f32_bits(ec_from_extensive(ee_mass_product(mass,
        eo_original[packed + 9u].z, eo_original[packed + 9u].w, false)), ec_from_mass(available), -299));
      let seed = eo_original[packed + 12u].w;
      var reference_mass = eo_scaled_fraction(mass, seed, available);
      if (seed != 0u) { reference_mass = eo_required(reference_mass); }
      if (!eo_finite(seed) || (seed >> 31u) != 0u) { error |= ${ERROR.INVALID_FLOAT}u; }
      error |= entities.error | rest_volume.error | current_volume.error | reference_mass.error;
      eo_particles[packed].w = projected_mass.bits; eo_particles[packed + 4u].y = entities.bits;
      eo_particles[packed + 9u].w = rest_volume.bits; eo_particles[packed + 12u].w = reference_mass.bits;
    } else {
      if (ordinal < 2u || ordinal - 2u >= eo_packet[src + 5u]) { return EO_INVALID; }
      let product = eo_product_state(src, ordinal - 2u);
      let entities = eo_required(eo_quantity(mass, product.molar, true));
      let rest_volume = eo_required(eo_quantity(mass, product.rho, false));
      let fragment_support = eo_required(eo_support_fragment(support, mass, total));
      error |= product.error | entities.error | rest_volume.error | fragment_support.error;
      let extensive = src + eo_params.extensive_offset;
      let velocity = vec3<u32>(eo_packet[extensive], eo_packet[extensive + 1u], eo_packet[extensive + 2u]);
      let prior_position = eo_original[packed].xyz;
      eo_particles[packed] = vec4<u32>(prior_position, projected_mass.bits);
      eo_particles[packed + 1u] = vec4<u32>(velocity, product.u_bits);
      eo_particles[packed + 2u] = vec4<u32>(product.material, product.phase, product.temperature, product.rho);
      let phase = u32(bitcast<f32>(product.phase));
      eo_particles[packed + 3u] = vec4<u32>(select(0u, 0x3f800000u, phase == 1u),
        select(0u, 0x3f800000u, phase == 2u), select(0u, 0x3f800000u, phase == 3u), 0u);
      let previous_thermo = eo_original[packed + 4u];
      eo_particles[packed + 4u] = vec4<u32>(previous_thermo.x, entities.bits, 0x3f800000u, previous_thermo.w);
      eo_particles[packed + 5u] = vec4<u32>(0x3f800000u, 0u, 0u, 0u);
      eo_particles[packed + 6u] = vec4<u32>(0x3f800000u, 0u, 0u, 0u);
      eo_particles[packed + 7u] = vec4<u32>(0x3f800000u, 0u, 0u, 0u);
      eo_particles[packed + 8u] = vec4<u32>(0u);
      eo_particles[packed + 9u] = vec4<u32>(0u, 0u, 0x3f800000u, rest_volume.bits);
      eo_particles[packed + 10u] = vec4<u32>(product.solid, 0x3f800000u, product.bulk, product.shear);
      eo_particles[packed + 11u] = vec4<u32>(product.lambda, product.sound, product.eos, 0x3f800000u);
      eo_particles[packed + 12u] = vec4<u32>(0u, 0u, 0u, projected_mass.bits);
    }
  }
  for (var i = 0u; i < 13u; i++) {
    let value = eo_particles[packed + i];
    if (!eo_finite(value.x) || !eo_finite(value.y) || !eo_finite(value.z) || !eo_finite(value.w)) { error |= ${ERROR.INVALID_FLOAT}u; }
  }
  eo_aux[carrier] = select(kind, 3u, kind == 0u);
  eo_aux[carrier + 1u] = select(row, 0xffffffffu, kind == 2u); eo_aux[carrier + 2u] = pair;
  eo_aux[carrier + 3u] = ordinal; eo_aux[carrier + 4u] = eo_routes[descriptor + 4u];
  eo_aux[carrier + 5u] = eo_routes[descriptor + 5u]; eo_aux[carrier + 6u] = select(1u, 0u, em_zero(mass));
  eo_store_mass(carrier + 8u, mass);
  return error;
}
@compute @workgroup_size(1)
fn stage_exact_reaction_outputs(@builtin(global_invocation_id) id: vec3<u32>) {
  let pair = id.x;
  if (pair >= eo_params.count) { return; }
  let src = pair * eo_params.source_words; let route = pair * eo_params.route_words;
  if (eo_routes[route] != 1u) {
    eo_aux[pair * 16u + 1u] = eo_routes[route + 1u]; return;
  }
  let peer = eo_routes[route + 3u]; let count = eo_routes[route + 5u];
  if (peer <= pair || peer >= eo_params.count || count == 0u || count > eo_params.product_capacity) {
    eo_aux[pair * 16u + 1u] = EO_INVALID; return;
  }
  var error = eo_routes[route + 1u] | eo_packet[src + 1u]
    | eo_packet[src + eo_params.caloric_offset + 1u] | eo_packet[src + eo_params.energy_offset + 1u]
    | eo_packet[src + eo_params.species_offset + 1u];
  if (eo_routes[route + 2u] != pair || eo_routes[route + 8u] != 0u
      || eo_packet[src] != 1u || eo_packet[src + 11u] != 0u || eo_packet[src + 5u] != count
      || eo_packet[src + eo_params.caloric_offset] != 1u || eo_packet[src + eo_params.energy_offset] != 1u
      || eo_packet[src + eo_params.species_offset] != 1u || eo_params.reserved0 != 0u || eo_params.reserved1 != 0u) {
    error |= EO_INVALID;
  }
  let total = eo_packet_mass(src + 12u); let support = eo_consumed_support(src); error |= support.error;
  var midpoint = vec3<u32>(0u); var projection_flags = eo_packet[src + eo_params.extensive_offset + 3u];
  error |= projection_flags & ~${ERROR.PROJECTION_UNDERFLOW}u;
  let a = eo_packet[src + 2u]; let b = eo_packet[src + 3u];
  let ca = eo_packet_mass(src + 12u + EM_WORDS); let cb = eo_packet_mass(src + 12u + 2u * EM_WORDS);
  for (var axis = 0u; axis < 3u; axis++) {
    let position = ee_add(ee_mass_scaled(ca, eo_original[a * 13u][axis]), ee_mass_scaled(cb, eo_original[b * 13u][axis]));
    let projected = er_project_f32_bits(ec_from_extensive(position), ec_from_mass(total), -299);
    midpoint[axis] = projected.bits; projection_flags |= projected.error;
    error |= projected.error & ~${ERROR.PROJECTION_UNDERFLOW}u;
  }
  if (error != 0u) { eo_reject(pair, peer, error); return; }
  for (var slot = 0u; slot < 2u; slot++) {
    error |= eo_stage_endpoint(pair, src, route, slot, support, total);
    if (error != 0u) { eo_reject(pair, peer, error); return; }
  }
  for (var local = 0u; local < count; local++) {
    let source = src + 12u + 7u * EM_WORDS + local * (4u + 3u * EM_WORDS);
    let fragment = route + 16u + (2u + local) * (8u + EM_WORDS);
    let mass = eo_packet_mass(source + 4u); let residual = eo_route_mass(fragment + 8u);
    let direct = em_subtract(mass, residual); error |= direct.error;
    var endpoint_direct = ExactMass();
    for (var slot = 0u; slot < 2u; slot++) {
      let endpoint = route + 16u + slot * (8u + EM_WORDS);
      if (eo_routes[endpoint] == 2u && eo_routes[endpoint + 3u] == local + 2u) {
        let sum = em_add(endpoint_direct, eo_route_mass(endpoint + 8u)); endpoint_direct = sum.value; error |= sum.error;
      }
    }
    if (em_compare(endpoint_direct, direct.value) != 0 || eo_routes[fragment] != pair
        || eo_routes[fragment + 1u] != local + 2u || eo_routes[fragment + 2u] != eo_packet[source]
        || eo_routes[fragment + 3u] != eo_packet[source + 1u]) { error |= EO_INVALID; }
    let event = pair * eo_params.product_capacity + local;
    let companion = eo_params.event_offset + event * eo_params.event_stride;
    eo_aux[companion] = pair; eo_aux[companion + 1u] = eo_packet[source];
    eo_aux[companion + 2u] = local + 2u; eo_aux[companion + 3u] = eo_packet[source + 1u];
    eo_aux[companion + 4u] = select(1u, 0u, em_zero(mass)); eo_aux[companion + 5u] = 1u;
    eo_store_mass(companion + 8u, mass); eo_store_mass(companion + 8u + EM_WORDS, direct.value);
    eo_store_mass(companion + 8u + 2u * EM_WORDS, residual);
    if (error != 0u) { eo_reject(pair, peer, error); return; }
    if (em_zero(mass)) { continue; }
    let product = eo_product_state(src, local);
    let projected_mass = eo_required(em_project_f32_bits(mass));
    var projected_direct = em_project_f32_bits(direct.value); var projected_residual = em_project_f32_bits(residual);
    if (!em_zero(direct.value)) { projected_direct = eo_required(projected_direct); }
    if (!em_zero(residual)) { projected_residual = eo_required(projected_residual); }
    let moles = eo_required(eo_quantity(mass, product.molar, false));
    var fragment_support = eo_support_fragment(support, residual, total);
    if (!em_zero(residual)) { fragment_support = eo_required(fragment_support); }
    let global_term = eo_index(eo_packet[source]); let rx = eo_index(eo_packet[src + 4u]);
    let source_index = eo_index(pair); let peer_index = eo_index(peer);
    error |= product.error | projected_mass.error | projected_direct.error | projected_residual.error
      | moles.error | fragment_support.error | global_term.error | rx.error | source_index.error | peer_index.error;
    if (error != 0u) { eo_reject(pair, peer, error); return; }
    let output = event * 8u; let extensive = src + eo_params.extensive_offset;
    eo_events[output] = vec4<u32>(midpoint, projected_mass.bits);
    eo_events[output + 1u] = vec4<u32>(product.material, global_term.bits, rx.bits, source_index.bits);
    eo_events[output + 2u] = vec4<u32>(peer_index.bits, moles.bits, product.routing, product.phase);
    eo_events[output + 3u] = vec4<u32>(projected_direct.bits, projected_residual.bits, product.coefficient, product.molar);
    eo_events[output + 4u] = vec4<u32>(product.temperature, product.rho, 0x3f800000u, product.u_bits);
    eo_events[output + 5u] = vec4<u32>(eo_packet[extensive], eo_packet[extensive + 1u], eo_packet[extensive + 2u], fragment_support.bits);
    eo_events[output + 6u] = vec4<u32>(product.bulk, product.shear, product.lambda, product.sound);
    eo_events[output + 7u] = vec4<u32>(product.eos, product.solid, 0x3f800000u, 0x3f800000u);
  }
  let header = pair * 16u;
  eo_aux[header + 2u] = pair; eo_aux[header + 3u] = peer; eo_aux[header + 4u] = eo_packet[src + 4u];
  eo_aux[header + 5u] = count; eo_aux[header + 7u] = projection_flags;
  // Complete projected staging is not chemistry/placement acceptance. The
  // immutable parent still owns the once-per-pair element/charge discrepancy.
  eo_aux[header] = 1u;
}
`;
}
