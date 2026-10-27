import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphReactionEnergyGraphWgsl } from '../../../ulg-gpu-abi/src/sphReactionEnergyWgsl.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';

// This is only dispatch coverage within the original owner's private output.
// It is not a source, physical-owner or publication capability. Finalized rows
// have the original ABI, with all four reserved header words restored to zero.
const STAGE_MAGIC = 0x58515331, STAGE_VERSION = 1;
export const SPH_EXACT_PLACEMENT_QUANTITY_STAGES = Object.freeze([
  Object.freeze({ stage: 'initialize', entryPoint: 'initialize_exact_placement_quantities' }),
  ...Array.from({ length: 7 }, (_, field) => Object.freeze({ stage: 'field', field,
    entryPoint: `materialize_exact_placement_quantity_field_${field}` })),
  Object.freeze({ stage: 'finalize', entryPoint: 'finalize_exact_placement_quantities' })
]);

// The original graph factory is composed unchanged. The unused record accessor
// is harmless: initialization reaches only energy_relaxed_mechanics. No source
// expression is found/replaced with a regex or a different scientific law.
const originalGraph = createSphReactionEnergyGraphWgsl({ record: index => `xq_unused_record(${index})` });

function declarations(format, layout) {
  return /* wgsl */ `
const XQ_N: u32 = ${format.wordCount}u;
const XQ_STRIDE: u32 = ${layout.recordWords}u;
const XQ_SCALAR: u32 = ${layout.scalar.recordWords}u;
const XQ_OFFSET: u32 = ${layout.scalarOffsetWords}u;
const XQ_UNAVAILABLE: u32 = 4194304u;
const XQ_STAGE_MAGIC: u32 = ${STAGE_MAGIC}u;
const XQ_STAGE_VERSION: u32 = ${STAGE_VERSION}u;
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
`;
}
const massReaders = /* wgsl */ `
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
`;
const initialization = /* wgsl */ `
fn xq_unused_record(index: u32) -> vec4<f32> { return vec4<f32>(0.0); }
fn xq_original_vec(at: u32) -> vec4<f32> {
  return bitcast<vec4<f32>>(vec4<u32>(xq_original[at], xq_original[at + 1u],
    xq_original[at + 2u], xq_original[at + 3u]));
}
fn xq_molar(material: u32) -> u32 {
  for (var i = 0u; i < xq_params.molar_count; i++) {
    if (xq_molars[i * 2u] == material) { return xq_molars[i * 2u + 1u]; }
  }
  return 0u;
}
@compute @workgroup_size(1)
fn initialize_exact_placement_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let output = id.x; let count = xq_params.count;
  if (output >= 2u * count + xq_params.capacity) { return; }
  let dest = output * XQ_STRIDE;
  // The original owner clears this buffer ONCE before its fixed schedule. A
  // duplicate/late initializer cannot erase a provisional, failed or completed
  // row and cannot turn a malformed schedule into numeric readiness.
  var dirty = false;
  for (var i = 0u; i < XQ_STRIDE; i++) { dirty = dirty || xq_values[dest + i] != 0u; }
  if (dirty) {
    xq_values[dest] = 0u; xq_values[dest + 1u] |= 8192u; xq_values[dest + 15u] = 0u; return;
  }
  // Canonical-zero fields make interrupted/rejected rows safe diagnostics.
  // The first-clear contract is checked above; no earlier error is discarded.
  for (var i = 0u; i < XQ_STRIDE; i++) { xq_values[dest + i] = 0u; }
  for (var field = 0u; field < 7u; field++) {
    xq_values[dest + XQ_OFFSET + field * XQ_SCALAR + 4u + ${'__R__'}u] = 1u;
  }
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
  xq_values[dest + 1u] = error; xq_values[dest + 2u] = material; xq_values[dest + 3u] = phase;
  xq_values[dest + 4u] = molar; xq_values[dest + 5u] = kind; xq_values[dest + 6u] = row;
  xq_values[dest + 7u] = pair; xq_values[dest + 8u] = ordinal;
  xq_values[dest + 9u] = XQ_N; xq_values[dest + 10u] = ${'__R__'}u;
  xq_values[dest + 11u] = select(0u, 1u, has_mass);
  xq_values[dest + 12u] = XQ_STAGE_MAGIC; xq_values[dest + 13u] = 0u;
  xq_values[dest + 14u] = 0u; xq_values[dest + 15u] = XQ_STAGE_VERSION;
}
`;

// These are explicit copies of the original selected field formulas. The JS
// switch chooses a field at code generation; WGSL sees no runtime field branch.
function seedScalar(field) {
  const body = field < 3 ? /* wgsl */ `
  return xr_multiply(mass, xr_from_f32_bits(xq_original[at + 4u + ${field}u]));`
    : field === 3 ? /* wgsl */ `
  var specific = xr_from_f32_bits(xq_original[at + 7u]);
  for (var axis = 0u; axis < 3u; axis++) {
    let velocity = xr_from_f32_bits(xq_original[at + 4u + axis]);
    specific = xr_add(specific, xr_scale_pow2(xr_multiply(velocity, velocity), -1));
  }
  return xr_multiply(mass, specific);`
    : field === 4 ? /* wgsl */ `
  let rest = xr_from_f32_bits(xq_original[at + 39u]);
  return rest;`
    : field === 5 ? /* wgsl */ `
  let rest = xr_from_f32_bits(xq_original[at + 39u]);
  return xr_multiply(rest, xr_from_f32_bits(xq_original[at + 38u]));`
    : /* wgsl */ `
  return xr_from_f32_bits(xq_original[at + 51u]);`;
  return /* wgsl */ `
fn xq_seed_selected_scalar(row: u32, mass: ExactRational) -> ExactRational {
  let at = row * 52u;${body}
}
`;
}
function extensiveReader(format) {
  const ee = format.wordCount + 18;
  return /* wgsl */ `
fn xq_extensive(packet: u32, field: u32) -> ExactRational {
  let at = packet + xq_params.extensive_offset + 4u + field * ${ee + 2}u;
  var value = xr_zero(); value.negative = xq_packet[at]; value.error = xq_packet[at + 1u];
  value.exponent = ${format.quantumExponent - 299};
  for (var i = 0u; i < ${ee}u; i++) { value.numerator[i] = xq_packet[at + 2u + i]; }
  return xr_normalize(value);
}
`;
}
function residualReader(format) {
  const ec = 3 * format.wordCount + 26;
  return /* wgsl */ `
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
`;
}
function productScalar(format, field) {
  const mass = `  let mass = xr_scale_pow2(units, ${format.quantumExponent});\n`;
  const fraction = '  let fraction = xr_divide(units, xq_packet_mass(packet + 12u));\n';
  const state = /* wgsl */ `  let state = packet + xq_params.caloric_offset + xq_params.product_offset
    + (2u * xq_params.product_capacity + ordinal - 2u) * 8u;
`;
  const body = field < 3 ? fraction + `  return xr_multiply(fraction, xq_extensive(packet, ${field}u));`
    : field === 3 ? mass + fraction + state + /* wgsl */ `
  // U is term-specific. Only COM kinetic and the physical correction are
  // shared by mass fraction; uniformly splitting pair total E is incorrect.
  let internal = xr_multiply(mass, xr_from_f32_bits(xq_packet[state + 4u]));
  let shared_energy = xr_add(xq_extensive(packet, 10u), xq_energy_residual(packet));
  return xr_add(internal, xr_multiply(fraction, shared_energy));`
    : field < 6 ? mass + state + '  return xr_divide(mass, xr_from_f32_bits(xq_packet[state + 5u]));'
    : mass + '  return mass;';
  return /* wgsl */ `
fn xq_product_selected_scalar(packet: u32, ordinal: u32, units: ExactRational) -> ExactRational {
${body}
}
`;
}
function fieldPass(format, layout, field) {
  return /* wgsl */ `
fn xq_store_scalar(at: u32, value: ExactRational) {
  xq_values[at] = value.negative; xq_values[at + 1u] = value.error;
  xq_values[at + 2u] = bitcast<u32>(value.exponent); xq_values[at + 3u] = value.reserved;
  for (var i = 0u; i < ${layout.scalar.wordCount}u; i++) {
    xq_values[at + 4u + i] = value.numerator[i];
    xq_values[at + 4u + ${layout.scalar.wordCount}u + i] = value.denominator[i];
  }
}
@compute @workgroup_size(1)
fn materialize_exact_placement_quantity_field_${field}(@builtin(global_invocation_id) id: vec3<u32>) {
  let output = id.x; let count = xq_params.count;
  if (output >= 2u * count + xq_params.capacity) { return; }
  let dest = output * XQ_STRIDE;
  if (xq_values[dest] != 0u || xq_values[dest + 12u] != XQ_STAGE_MAGIC
      || xq_values[dest + 13u] != ${field}u || xq_values[dest + 14u] != ${(1 << field) - 1}u
      || xq_values[dest + 15u] != XQ_STAGE_VERSION) {
    xq_values[dest] = 0u; xq_values[dest + 1u] |= 8192u; xq_values[dest + 15u] = 0u; return;
  }
  var error = xq_values[dest + 1u]; var value = xr_zero();
  if (xq_values[dest + 11u] != 0u && error == 0u) {
    var units = xr_zero();
    for (var i = 0u; i < XQ_N; i++) { units.numerator[i] = xq_values[dest + 16u + i]; }
    units = xr_normalize(units);
    let kind = xq_values[dest + 5u]; let row = xq_values[dest + 6u];
    if (kind == 2u) {
      let packet = xq_values[dest + 7u] * xq_params.packet_words;
      value = xq_product_selected_scalar(packet, xq_values[dest + 8u], units);
    } else {
      let original_units = xq_original_mass(row);
      value = xq_seed_selected_scalar(row, xr_scale_pow2(original_units, ${format.quantumExponent}));
      if (kind == 1u) { value = xr_multiply(value, xr_divide(units, original_units)); }
    }
  }
  error |= value.error; xq_store_scalar(dest + XQ_OFFSET + ${field}u * XQ_SCALAR, value);
  xq_values[dest + 1u] = error; xq_values[dest + 13u] = ${field + 1}u;
  xq_values[dest + 14u] = ${(1 << (field + 1)) - 1}u;
}
`;
}
const finalization = /* wgsl */ `
@compute @workgroup_size(1)
fn finalize_exact_placement_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let output = id.x; let count = xq_params.count;
  if (output >= 2u * count + xq_params.capacity) { return; }
  let dest = output * XQ_STRIDE; var error = xq_values[dest + 1u];
  let complete = xq_values[dest] == 0u && xq_values[dest + 12u] == XQ_STAGE_MAGIC
    && xq_values[dest + 13u] == 7u && xq_values[dest + 14u] == 127u
    && xq_values[dest + 15u] == XQ_STAGE_VERSION;
  if (!complete) { error |= 8192u; }
  // Missing initializer has no canonical fields to preserve. The initializer
  // always writes N/R; this failure case gets canonical-zero scalars explicitly.
  if (xq_values[dest + 9u] != XQ_N || xq_values[dest + 10u] != ${'__R__'}u) {
    for (var field = 0u; field < 7u; field++) {
      let at = dest + XQ_OFFSET + field * XQ_SCALAR;
      for (var i = 0u; i < XQ_SCALAR; i++) { xq_values[at + i] = 0u; }
      xq_values[at + 4u + ${'__R__'}u] = 1u;
    }
  }
  for (var i = 12u; i < 16u; i++) { xq_values[dest + i] = 0u; }
  xq_values[dest + 1u] = error; xq_values[dest] = select(0u, 1u, complete && error == 0u);
}
`;

export function createSphExactPlacementQuantityStagedWgsl(format, layout, descriptor, { carriedSourceLayout = null } = {}) {
  validateSphExactMassFormat(format);
  if (layout.massWordCount !== format.wordCount) throw new TypeError('Mismatched exact quantity format');
  const stage = descriptor?.stage, field = descriptor?.field;
  if (!['initialize', 'field', 'finalize'].includes(stage)
      || (stage === 'field' && (!Number.isInteger(field) || field < 0 || field > 6))) {
    throw new RangeError('Exact quantity stage/field required');
  }
  if (carriedSourceLayout && stage === 'field') throw new TypeError('Carried fields require the production primitive schedule');
  const header = declarations(format, layout);
  // Placeholder replacement is layout substitution only, never a scientific
  // expression rewrite. Finalization needs no rational arithmetic call graph.
  if (stage === 'finalize') return header + finalization.replaceAll('__R__', String(layout.scalar.wordCount));
  const numeric = createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount });
  const sourceReady = carriedSourceLayout ? /* wgsl */ `
@group(0) @binding(11) var<storage, read> xq_carried: array<u32>;
fn xq_additional_source_ready(row: u32) -> bool {
  let at = row * ${carriedSourceLayout.recordWords}u;
  if (xq_carried[at] != 1u || xq_carried[at + 1u] != 0u || xq_carried[at + 9u] != XQ_N
      || xq_carried[at + 10u] != ${layout.scalar.wordCount}u || xq_carried[at + 11u] != 1u
      || xq_carried[at + 2u] != u32(bitcast<f32>(xq_original[row * 52u + 8u]))
      || xq_carried[at + 3u] != u32(bitcast<f32>(xq_original[row * 52u + 9u]))
      || xq_carried[at + 4u] != xq_molar(xq_carried[at + 2u])) { return false; }
  for (var i = 12u; i < 16u; i++) { if (xq_carried[at + i] != 0u) { return false; } }
  for (var i = 0u; i < XQ_N; i++) {
    if (xq_carried[at + ${carriedSourceLayout.massOffsetWords}u + i] != xq_inventory[xq_params.inventory_offset + row * XQ_N + i]) { return false; }
  }
  for (var field = 0u; field < 7u; field++) {
    let source = at + ${carriedSourceLayout.scalarOffsetWords}u + field * XQ_SCALAR;
    if (xq_carried[source + 1u] != 0u || xq_carried[source + 3u] != 0u) { return false; }
  }
  return true;
}
// Existing extensive quantities and the unchanged physical record can be
// retained even when chemistry rejects a deformed/affine source. The original
// reaction graph still requires relaxed mechanics before a chemical debit.
fn xq_seed_ready(row: u32) -> bool { return xq_additional_source_ready(row); }
` : /* wgsl */ `
fn xq_seed_ready(row: u32) -> bool {
  let m = row * 52u + 20u;
  return energy_relaxed_mechanics(xq_original_vec(m), xq_original_vec(m + 4u),
    xq_original_vec(m + 8u), xq_original_vec(m + 12u), xq_original_vec(m + 16u));
}
`;
  if (stage === 'initialize') return numeric + header + massReaders + originalGraph + sourceReady
    + initialization.replaceAll('__R__', String(layout.scalar.wordCount));
  return numeric + header + massReaders
    + (field <= 3 ? extensiveReader(format) : '') + (field === 3 ? residualReader(format) : '')
    + seedScalar(field) + productScalar(format, field) + fieldPass(format, layout, field);
}

export function sphExactPlacementQuantityStagedPipelineDescriptors(format, layout) {
  return Object.freeze(SPH_EXACT_PLACEMENT_QUANTITY_STAGES.map(stage => Object.freeze({
    ...stage, label: `ulg-exact-placement-quantity-${stage.stage}${stage.field === undefined ? '' : `-${stage.field}`}`,
    cacheKey: `ulg-exact-placement-quantity-staged-v1-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}-${stage.stage}${stage.field === undefined ? '' : `-${stage.field}`}`,
    code: createSphExactPlacementQuantityStagedWgsl(format, layout, stage),
    bindings: Object.freeze([...Array(7).fill('read-only-storage'), 'storage', 'uniform'])
  })));
}
