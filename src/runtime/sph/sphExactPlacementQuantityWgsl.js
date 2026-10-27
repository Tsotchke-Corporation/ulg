import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphReactionEnergyGraphWgsl } from '../../../ulg-gpu-abi/src/sphReactionEnergyWgsl.js';
import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout }
  from './sphExactRationalQuantityWgsl.js';

export const SPH_EXACT_PLACEMENT_QUANTITY_FIELDS = Object.freeze([
  'momentumX', 'momentumY', 'momentumZ', 'totalEnergy', 'restVolume', 'currentVolume', 'phaseReferenceMass'
]);
const checked = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0x3fffffff) {
    throw new RangeError(`Exact placement quantity ${name} exceeds word addressing`);
  }
  return value;
};

/** Independent current values, not references to a predecessor packet. The
 * first-fragment envelope is not a bound on repeated rational merges. A later
 * producer must consume these values and explicitly handle capacity failure.
 * Header16: ready,error,material,phase,molarBits,kind,sourceRow,pair,ordinal,
 * massWords,rationalWords,active,reserved[4]; mass[N]; seven rational scalars.
 * Moles/entities derive from exact mass and the original molar identity.
 */
export function sphExactPlacementQuantityLayout(format, { particleCount, eventCapacity,
  rationalWordCount = 4 * format.wordCount + 27 } = {}) {
  validateSphExactMassFormat(format);
  checked(particleCount, 'particle count'); checked(eventCapacity, 'event capacity');
  if (rationalWordCount < 4 * format.wordCount + 27) {
    throw new RangeError('Exact placement quantity capacity cannot truncate the initial fragment envelope');
  }
  const scalar = sphExactRationalQuantityLayout({ wordCount: rationalWordCount });
  const scalarOffsetWords = 16 + format.wordCount;
  const recordWords = checked(scalarOffsetWords + 7 * scalar.recordWords, 'record');
  const rowCount = checked(2 * particleCount + eventCapacity, 'row count');
  return Object.freeze({ particleCount, eventCapacity, rowCount, recordWords,
    headerWords: 16, massWordCount: format.wordCount, massOffsetWords: 16,
    scalarOffsetWords, scalar, fields: SPH_EXACT_PLACEMENT_QUANTITY_FIELDS,
    originalRowOffset: 0, currentRowOffset: particleCount, eventRowOffset: 2 * particleCount,
    wordLength: checked(rowCount * recordWords, 'arena') });
}

// Original thermal-table identities keep inert carriers present through a
// reaction. Compiler identities must agree. Missing identities stay explicit;
// rounded entity counts never reconstruct a molecular mass.
export function encodeSphExactPlacementMolarMetadata(compiled, expected) {
  const rows = new Map();
  const validate = () => compiled.forEach(token => resolveSphExactReactionAllocation(token, expected));
  validate();
  const identities = expected.thermalMaterialTable?.molarMassIdentities;
  if (identities != null) {
    if (!(identities instanceof Uint32Array) || identities.length % 2) throw new TypeError('Packed original molecular identities required');
    for (let i = 0; i < identities.length; i += 2) {
      const material = identities[i], bits = identities[i + 1];
      if (bits < 0x00800000 || bits >= 0x7f800000) continue;
      if (!material || material > 0xffffff || (rows.has(material) && rows.get(material) !== bits)) {
        throw new TypeError('Conflicting original exact material molar identities');
      }
      rows.set(material, bits);
    }
  }
  for (const token of compiled) for (const term of [...token.reactants, ...token.products]) {
    const bits = new Uint32Array(new Float32Array([term.molarMass]).buffer)[0];
    if (rows.has(term.materialId) && rows.get(term.materialId) !== bits) {
      throw new TypeError('Conflicting original exact material molar identities');
    }
    rows.set(term.materialId, bits);
  }
  validate();
  return new Uint32Array([...rows].sort((a, b) => a[0] - b[0]).flat());
}

const relaxed = createSphReactionEnergyGraphWgsl({ record: index => `unused_record(${index})` })
  .match(/fn energy_relaxed_mechanics\([\s\S]*?\n}/)?.[0]
  ?.replace('energy_relaxed_mechanics', 'xq_relaxed_mechanics').replaceAll('energy_finite', 'xq_finite');
if (!relaxed) throw new Error('Missing original reaction relaxed-energy domain');

export function createSphExactPlacementQuantityWgsl(format, layout) {
  validateSphExactMassFormat(format);
  if (layout.massWordCount !== format.wordCount) throw new TypeError('Mismatched exact quantity format');
  const n = format.wordCount, ee = n + 18, ec = 3 * n + 26;
  return createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount }) + /* wgsl */ `
const XQ_N: u32 = ${n}u;
const XQ_STRIDE: u32 = ${layout.recordWords}u;
const XQ_SCALAR: u32 = ${layout.scalar.recordWords}u;
const XQ_OFFSET: u32 = ${layout.scalarOffsetWords}u;
const XQ_UNAVAILABLE: u32 = 4194304u;
struct ExactQuantityParams {
  count: u32, capacity: u32, packet_words: u32, inventory_offset: u32,
  carrier_offset: u32, carrier_stride: u32, companion_stride: u32, molar_count: u32,
  extensive_offset: u32, caloric_offset: u32, product_offset: u32, product_capacity: u32,
  energy_offset: u32, species_offset: u32, species_term_offset: u32, species_term_stride: u32
}
@group(0) @binding(0) var<storage, read> xq_original: array<u32>;
@group(0) @binding(1) var<storage, read> xq_packet: array<u32>;
@group(0) @binding(2) var<storage, read> xq_inventory: array<u32>;
@group(0) @binding(3) var<storage, read> xq_aux: array<u32>;
@group(0) @binding(4) var<storage, read> xq_companions: array<u32>;
@group(0) @binding(5) var<storage, read> xq_count: array<u32>;
@group(0) @binding(6) var<storage, read> xq_molars: array<u32>;
@group(0) @binding(7) var<storage, read_write> xq_values: array<u32>;
@group(0) @binding(8) var<uniform> xq_params: ExactQuantityParams;
fn xq_finite(value: f32) -> bool { return abs(value) <= 3.402823e38; }
${relaxed}
fn xq_original_vec(at: u32) -> vec4<f32> {
  return bitcast<vec4<f32>>(vec4<u32>(xq_original[at], xq_original[at + 1u],
    xq_original[at + 2u], xq_original[at + 3u]));
}
fn xq_seed_ready(row: u32) -> bool {
  let m = row * 52u + 20u;
  return xq_relaxed_mechanics(xq_original_vec(m), xq_original_vec(m + 4u),
    xq_original_vec(m + 8u), xq_original_vec(m + 12u), xq_original_vec(m + 16u));
}
fn xq_molar(material: u32) -> u32 {
  for (var i = 0u; i < xq_params.molar_count; i++) {
    if (xq_molars[i * 2u] == material) { return xq_molars[i * 2u + 1u]; }
  }
  return 0u;
}
fn xq_packet_mass(at: u32) -> ExactRational {
  var value = xr_zero();
  for (var i = 0u; i < XQ_N; i++) { value.numerator[i] = xq_packet[at + i]; }
  return xr_normalize(value);
}
fn xq_original_mass(row: u32) -> ExactRational {
  var value = xr_zero();
  for (var i = 0u; i < XQ_N; i++) {
    value.numerator[i] = xq_inventory[xq_params.inventory_offset + row * XQ_N + i];
  }
  return xr_normalize(value);
}
fn xq_extensive(packet: u32, field: u32) -> ExactRational {
  let at = packet + xq_params.extensive_offset + 4u + field * ${ee + 2}u;
  var value = xr_zero(); value.negative = xq_packet[at]; value.error = xq_packet[at + 1u];
  value.exponent = ${format.quantumExponent - 299};
  for (var i = 0u; i < ${ee}u; i++) { value.numerator[i] = xq_packet[at + 2u + i]; }
  return xr_normalize(value);
}
fn xq_energy_residual(packet: u32) -> ExactRational {
  let energy = packet + xq_params.energy_offset;
  let at = energy + ${8 + ec + 2}u;
  let denominator = packet + xq_params.caloric_offset + ${16 + ec + 2}u;
  var value = xr_zero(); value.negative = xq_packet[at];
  value.error = xq_packet[at + 1u] | xq_packet[denominator + 1u];
  if (xq_packet[denominator] != 0u) { value.error |= 8192u; }
  value.exponent = bitcast<i32>(xq_packet[energy + 3u]);
  for (var i = 0u; i < ${ec}u; i++) {
    value.numerator[i] = xq_packet[at + 2u + i];
    value.denominator[i] = xq_packet[denominator + 2u + i];
  }
  return xr_normalize(value);
}
fn xq_seed_scalar(row: u32, field: u32, mass: ExactRational) -> ExactRational {
  let at = row * 52u;
  if (field < 3u) { return xr_multiply(mass, xr_from_f32_bits(xq_original[at + 4u + field])); }
  if (field == 3u) {
    var specific = xr_from_f32_bits(xq_original[at + 7u]);
    for (var axis = 0u; axis < 3u; axis++) {
      let velocity = xr_from_f32_bits(xq_original[at + 4u + axis]);
      specific = xr_add(specific, xr_scale_pow2(xr_multiply(velocity, velocity), -1));
    }
    return xr_multiply(mass, specific);
  }
  let rest = xr_from_f32_bits(xq_original[at + 39u]);
  if (field == 4u) { return rest; }
  if (field == 5u) { return xr_multiply(rest, xr_from_f32_bits(xq_original[at + 38u])); }
  return xr_from_f32_bits(xq_original[at + 51u]);
}
fn xq_product_scalar(packet: u32, ordinal: u32, field: u32, units: ExactRational) -> ExactRational {
  let mass = xr_scale_pow2(units, ${format.quantumExponent});
  let fraction = xr_divide(units, xq_packet_mass(packet + 12u));
  if (field < 3u) { return xr_multiply(fraction, xq_extensive(packet, field)); }
  let state = packet + xq_params.caloric_offset + xq_params.product_offset
    + (2u * xq_params.product_capacity + ordinal - 2u) * 8u;
  if (field == 3u) {
    // U is term-specific. Only COM kinetic and the physical correction are
    // shared by mass fraction; uniformly splitting pair total E is incorrect.
    let internal = xr_multiply(mass, xr_from_f32_bits(xq_packet[state + 4u]));
    let shared_energy = xr_add(xq_extensive(packet, 10u), xq_energy_residual(packet));
    return xr_add(internal, xr_multiply(fraction, shared_energy));
  }
  if (field < 6u) { return xr_divide(mass, xr_from_f32_bits(xq_packet[state + 5u])); }
  return mass;
}
fn xq_store_scalar(at: u32, value: ExactRational) {
  xq_values[at] = value.negative; xq_values[at + 1u] = value.error;
  xq_values[at + 2u] = bitcast<u32>(value.exponent); xq_values[at + 3u] = value.reserved;
  for (var i = 0u; i < ${layout.scalar.wordCount}u; i++) {
    xq_values[at + 4u + i] = value.numerator[i];
    xq_values[at + 4u + ${layout.scalar.wordCount}u + i] = value.denominator[i];
  }
}
@compute @workgroup_size(1)
fn materialize_exact_placement_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let output = id.x; let count = xq_params.count;
  if (output >= 2u * count + xq_params.capacity) { return; }
  let dest = output * XQ_STRIDE;
  var row = output; var pair = 0xffffffffu; var ordinal = 0xffffffffu;
  var kind = 0u; var material = 0u; var phase = 0u; var molar = 0u; var error = 0u;
  var units = xr_zero(); var has_mass = false;
  if (output < count) {
    units = xq_original_mass(row);
    for (var i = 0u; i < XQ_N; i++) { xq_values[dest + 16u + i] = xq_inventory[xq_params.inventory_offset + row * XQ_N + i]; }
  } else if (output < 2u * count) {
    row = output - count; let carrier = xq_params.carrier_offset + row * xq_params.carrier_stride;
    kind = xq_aux[carrier]; pair = xq_aux[carrier + 2u]; ordinal = xq_aux[carrier + 3u];
    for (var i = 0u; i < XQ_N; i++) {
      let word = xq_aux[carrier + 8u + i]; units.numerator[i] = word; xq_values[dest + 16u + i] = word;
    }
    units = xr_normalize(units);
  } else {
    row = output - 2u * count; kind = 2u;
    if (xq_count[1u] != 0u || xq_count[0u] > xq_params.capacity) { error |= 8192u; }
    if (row < min(xq_count[0u], xq_params.capacity)) {
      let event = row * xq_params.companion_stride;
      pair = xq_companions[event]; ordinal = xq_companions[event + 2u];
      if (xq_companions[event + 5u] != 1u) { error |= 8192u; }
      error |= xq_companions[event + 6u];
      for (var i = 0u; i < XQ_N; i++) {
        let word = xq_companions[event + 8u + 2u * XQ_N + i];
        units.numerator[i] = word; xq_values[dest + 16u + i] = word;
      }
      units = xr_normalize(units);
    } else { kind = 3u; }
  }
  for (var i = 0u; i < XQ_N; i++) { has_mass = has_mass || xq_values[dest + 16u + i] != 0u; }
  if (kind > 3u || (kind == 3u && has_mass)) { error |= 8192u; }
  if (kind < 2u) {
    let physical = row * 52u;
    material = u32(bitcast<f32>(xq_original[physical + 8u]));
    phase = u32(bitcast<f32>(xq_original[physical + 9u])); molar = xq_molar(material);
    if (has_mass && (!xq_seed_ready(row) || molar == 0u)) { error |= XQ_UNAVAILABLE; }
  }
  var packet = 0u;
  if (kind == 1u || kind == 2u) {
    if (pair >= count || ordinal >= xq_params.product_capacity + 2u) { error |= 8192u; }
    else {
      packet = pair * xq_params.packet_words;
      if (xq_aux[pair * 16u] != 1u || xq_aux[pair * 16u + 1u] != 0u) { error |= 8192u; }
      let species = packet + xq_params.species_offset + xq_params.species_term_offset
        + ordinal * xq_params.species_term_stride;
      molar = xq_packet[species + 5u];
      if (kind == 2u) {
        if (ordinal < 2u || ordinal - 2u >= xq_packet[packet + 5u]) { error |= 8192u; }
        else {
          let state = packet + xq_params.caloric_offset + xq_params.product_offset
            + (2u * xq_params.product_capacity + ordinal - 2u) * 8u;
          material = xq_packet[state + 1u]; phase = xq_packet[state + 2u];
        }
      } else if (ordinal >= 2u || xq_packet[packet + 2u + ordinal] != row) { error |= 8192u; }
    }
  }
  error |= units.error;
  for (var field = 0u; field < 7u; field++) {
    var value = xr_zero();
    if (has_mass && error == 0u) {
      if (kind == 2u) { value = xq_product_scalar(packet, ordinal, field, units); }
      else {
        let original_units = xq_original_mass(row);
        value = xq_seed_scalar(row, field, xr_scale_pow2(original_units, ${format.quantumExponent}));
        if (kind == 1u) { value = xr_multiply(value, xr_divide(units, original_units)); }
      }
    }
    error |= value.error; xq_store_scalar(dest + XQ_OFFSET + field * XQ_SCALAR, value);
  }
  xq_values[dest + 1u] = error; xq_values[dest + 2u] = material; xq_values[dest + 3u] = phase;
  xq_values[dest + 4u] = molar; xq_values[dest + 5u] = kind; xq_values[dest + 6u] = row;
  xq_values[dest + 7u] = pair; xq_values[dest + 8u] = ordinal;
  xq_values[dest + 9u] = XQ_N; xq_values[dest + 10u] = ${layout.scalar.wordCount}u;
  xq_values[dest + 11u] = select(0u, 1u, has_mass);
  xq_values[dest] = select(0u, 1u, error == 0u);
}
`;
}
