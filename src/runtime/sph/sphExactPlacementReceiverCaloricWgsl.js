import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphReactionEnergyGraphWgsl } from '../../../ulg-gpu-abi/src/sphReactionEnergyWgsl.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout }
  from './sphExactRationalQuantityWgsl.js';

export const SPH_EXACT_RECEIVER_CALORIC_ERROR = Object.freeze({
  SOURCE_NOT_READY: 4194304, DOMAIN: 8388608, INCOMPLETE_SEARCH: 16777216,
  INCONSISTENT_GRAPH: 33554432, AMBIGUOUS: 67108864
});
export const SPH_EXACT_RECEIVER_CALORIC_FIELDS = Object.freeze([
  'mass', 'targetInternalEnergy', 'trueComKineticEnergy', 'projectedKineticEnergy',
  'momentumResidualX', 'momentumResidualY', 'momentumResidualZ',
  'chosenThermalResidual', 'physicalViewEnergyResidual'
]);
// Queue-ordered arithmetic stages share private receiver scratch. State 3 is
// pending preparation; only the final stage exposes state 2 to caloric search.
export const SPH_EXACT_RECEIVER_PREPARATION_STAGES = Object.freeze([
  'mass_view', 'momentum_squared', 'momentum_sum', 'kinetic', 'internal',
  'velocity', 'velocity_view', 'view_momentum', 'view_kinetic', 'momentum_residual',
  'volume_identity', 'volume_ratio', 'volume_views', 'moles', 'entities', 'finish'
].map(name => Object.freeze({ key: `caloricPrepare_${name}`, label: `caloric-prepare-${name}`,
  entryPoint: `prepare_exact_receiver_${name}` })));
const checked = (x, label, positive = true) => {
  if (!Number.isSafeInteger(x) || x < Number(positive) || x > 0x3fffffff) {
    throw new RangeError(`Exact receiver caloric ${label} exceeds word addressing`);
  }
  return x;
};

// Numeric scratch only. Source and merged quantity ownership remain in the
// existing segmented placement transaction; this layout mints no authority.
export function sphExactPlacementReceiverCaloricLayout(format, quantityLayout,
  { receiverCapacity, maxIntervals, workWordCount = quantityLayout.scalar.wordCount } = {}) {
  validateSphExactMassFormat(format);
  if (quantityLayout.massWordCount !== format.wordCount
      || quantityLayout.scalarOffsetWords !== 16 + format.wordCount
      || quantityLayout.scalar.recordWords !== 4 + 2 * quantityLayout.scalar.wordCount
      || quantityLayout.recordWords !== quantityLayout.scalarOffsetWords + 7 * quantityLayout.scalar.recordWords) {
    throw new TypeError('Matching original exact quantity layout required');
  }
  if (workWordCount < quantityLayout.scalar.wordCount) throw new RangeError('Receiver work capacity cannot narrow retained quantities');
  const scalar = sphExactRationalQuantityLayout({ wordCount: workWordCount });
  checked(receiverCapacity, 'receiver capacity'); checked(maxIntervals, 'interval capacity');
  const receiverRecordWords = checked(32 + 9 * scalar.recordWords, 'receiver record');
  const intervalRecordWords = checked(16 + 2 * scalar.recordWords, 'interval record');
  return Object.freeze({ receiverCapacity, maxIntervals, scalar, receiverHeaderWords: 32,
    receiverRecordWords, intervalHeaderWords: 16, intervalRecordWords,
    receiverWordLength: checked(receiverCapacity * receiverRecordWords, 'receiver arena'),
    intervalWordLength: checked(receiverCapacity * maxIntervals * intervalRecordWords, 'interval arena'),
    fields: SPH_EXACT_RECEIVER_CALORIC_FIELDS, refinementDispatchCount: 31, uniformBytes: 32 });
}

// Pure buffer-shape encoder, not table authentication or physical admission.
// The held original placement/compiler context must separately validate DATA
// identities/snapshots before compilation, encoding, submission and commit.
export function encodeSphExactPlacementReceiverCaloricParams(layout, {
  receiverCount, quantityCount, physicalCount, graphRecordCount, caloricMetadata
}) {
  checked(receiverCount, 'receiver count', false); checked(quantityCount, 'quantity count');
  checked(physicalCount, 'physical count'); checked(graphRecordCount, 'graph record count');
  if (receiverCount > layout.receiverCapacity) throw new RangeError('Receiver dispatch exceeds scratch capacity');
  const words = caloricMetadata?.words;
  if (!(words instanceof Uint32Array) || words.length < 8 || words[0] !== 0x58514331
      || words[1] !== 1 || words[3] !== 8 || words[5] !== 8 || words[7] !== 0
      || words[6] !== 8 + words[2] * 8 || words.length !== words[6] + words[4] * 8) {
    throw new TypeError('Complete original receiver caloric metadata shape required');
  }
  checked(graphRecordCount + 2 * words[4], 'virtual descriptor addressing');
  for (let i = 0; i < words[2]; i++) {
    const at = 8 + i * 8;
    if (words[at + 3] === 0 || words[at + 3] + 2 >= graphRecordCount
        || words[at + 5] === 0 || words[at + 5] > layout.maxIntervals
        || words[at + 4] + words[at + 5] > words[4] || words[at + 6] || words[at + 7]) {
      throw new RangeError('Receiver descriptor/interval coverage exceeds original metadata');
    }
  }
  for (let i = 0; i < words[4]; i++) {
    const at = words[6] + i * 8, curve = words[at + 5];
    if (curve + 1 >= graphRecordCount || Math.fround(curve) !== curve || words[at + 6] || words[at + 7]) {
      throw new RangeError('Original curve index cannot be represented by one-curve probe metadata');
    }
  }
  return new Uint32Array([receiverCount, quantityCount, physicalCount, graphRecordCount,
    words[2], words[4], words[6], 0]);
}

export function createSphExactPlacementReceiverCaloricWgsl(format, quantityLayout, layout) {
  validateSphExactMassFormat(format);
  const expected = sphExactPlacementReceiverCaloricLayout(format, quantityLayout, { ...layout, workWordCount: layout.scalar.wordCount });
  for (const key of ['receiverRecordWords', 'intervalRecordWords', 'receiverWordLength', 'intervalWordLength']) {
    if (expected[key] !== layout[key]) throw new TypeError('Mismatched exact receiver layout');
  }
  const E = SPH_EXACT_RECEIVER_CALORIC_ERROR, R = layout.scalar.wordCount;
  let avogadro = 602214076000000000000000n;
  const avogadroWords = [];
  while (avogadro) { avogadroWords.push(Number(avogadro & 0xffffffffn)); avogadro >>= 32n; }
  return createSphExactRationalQuantityWgsl({ wordCount: R })
    + createSphReactionEnergyGraphWgsl({ record: index => `rc_graph_record(${index})` }) + /* wgsl */ `
const RC_R: u32 = ${R}u;
const RC_QR: u32 = ${quantityLayout.scalar.wordCount}u;
const RC_QS: u32 = ${quantityLayout.scalar.recordWords}u;
const RC_QSTRIDE: u32 = ${quantityLayout.recordWords}u;
const RC_QOFFSET: u32 = ${quantityLayout.scalarOffsetWords}u;
const RC_RS: u32 = ${layout.receiverRecordWords}u;
const RC_IS: u32 = ${layout.intervalRecordWords}u;
const RC_SCALAR: u32 = ${layout.scalar.recordWords}u;
const RC_INTERVALS: u32 = ${layout.maxIntervals}u;
// Adoption must resolve this through the shared numeric quantity schema.
// This kind describes data only and never authenticates its physical owner.
const RC_MERGED_CURRENT_KIND: u32 = 4u;
struct ReceiverCaloricParams {
  receiver_count: u32, quantity_count: u32, physical_count: u32, graph_count: u32,
  material_count: u32, interval_count: u32, interval_offset: u32, reserved: u32
}
struct ReceiverComparison { value: i32, error: u32 }
@group(0) @binding(0) var<storage, read> rc_quantities: array<u32>;
@group(0) @binding(1) var<storage, read> rc_receiver_rows: array<u32>;
@group(0) @binding(2) var<storage, read> rc_physical: array<u32>;
@group(0) @binding(3) var<storage, read> rc_metadata: array<u32>;
@group(0) @binding(4) var<storage, read> rc_graph: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> rc_receiver: array<u32>;
@group(0) @binding(6) var<storage, read_write> rc_intervals: array<u32>;
@group(0) @binding(7) var<uniform> rc_params: ReceiverCaloricParams;

// Original graph prefix is never altered. A virtual descriptor has only a
// one-curve list record, selecting an ORIGINAL curve for bracket probes. It is
// never used to validate the selected physical state or source readiness.
fn rc_graph_record(index: u32) -> vec4<f32> {
  if (index < rc_params.graph_count) { return rc_graph[index]; }
  let relative = index - rc_params.graph_count;
  let interval = relative / 2u;
  if ((relative & 1u) != 0u && interval < rc_params.interval_count) {
    let at = rc_params.interval_offset + interval * 8u;
    let curve = rc_metadata[at + 5u];
    if (curve < rc_params.graph_count) {
      return vec4<f32>(f32(curve), 1.0, 0.0, rc_graph[curve].x);
    }
  }
  return vec4<f32>(0.0);
}
fn rc_vec(at: u32) -> vec4<f32> {
  return bitcast<vec4<f32>>(vec4<u32>(rc_physical[at], rc_physical[at + 1u],
    rc_physical[at + 2u], rc_physical[at + 3u]));
}
fn rc_zero(value: ExactRational) -> bool {
  for (var i = 0u; i < RC_R; i++) { if (value.numerator[i] != 0u) { return false; } }
  return true;
}
fn rc_compare(a: ExactRational, b: ExactRational) -> ReceiverComparison {
  let difference = xr_subtract(a, b);
  return ReceiverComparison(select(select(1, -1, difference.negative != 0u), 0, rc_zero(difference)), difference.error);
}
fn rc_load_quantity(row: u32, field: u32) -> ExactRational {
  let at = row * RC_QSTRIDE + RC_QOFFSET + field * RC_QS;
  var value = xr_zero(); value.negative = rc_quantities[at]; value.error = rc_quantities[at + 1u];
  value.exponent = bitcast<i32>(rc_quantities[at + 2u]); value.reserved = rc_quantities[at + 3u];
  for (var i = 0u; i < RC_QR; i++) {
    value.numerator[i] = rc_quantities[at + 4u + i];
    value.denominator[i] = rc_quantities[at + 4u + RC_QR + i];
  }
  // Every consumer below immediately uses a checked rational arithmetic or
  // projection operation, which validates and normalizes its operands. Doing
  // that again in the loader duplicates the wide-integer call graph and its
  // private scratch in each driver program.
  return value;
}
fn rc_store(at: u32, value: ExactRational) {
  rc_receiver[at] = value.negative; rc_receiver[at + 1u] = value.error;
  rc_receiver[at + 2u] = bitcast<u32>(value.exponent); rc_receiver[at + 3u] = value.reserved;
  for (var i = 0u; i < RC_R; i++) { rc_receiver[at + 4u + i] = value.numerator[i]; rc_receiver[at + 4u + RC_R + i] = value.denominator[i]; }
}
fn rc_load(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = rc_receiver[at]; value.error = rc_receiver[at + 1u];
  value.exponent = bitcast<i32>(rc_receiver[at + 2u]); value.reserved = rc_receiver[at + 3u];
  for (var i = 0u; i < RC_R; i++) { value.numerator[i] = rc_receiver[at + 4u + i]; value.denominator[i] = rc_receiver[at + 4u + RC_R + i]; }
  return value;
}
fn rc_store_interval(at: u32, value: ExactRational) {
  rc_intervals[at] = value.negative; rc_intervals[at + 1u] = value.error;
  rc_intervals[at + 2u] = bitcast<u32>(value.exponent); rc_intervals[at + 3u] = value.reserved;
  for (var i = 0u; i < RC_R; i++) { rc_intervals[at + 4u + i] = value.numerator[i]; rc_intervals[at + 4u + RC_R + i] = value.denominator[i]; }
}
fn rc_load_interval(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = rc_intervals[at]; value.error = rc_intervals[at + 1u];
  value.exponent = bitcast<i32>(rc_intervals[at + 2u]); value.reserved = rc_intervals[at + 3u];
  for (var i = 0u; i < RC_R; i++) { value.numerator[i] = rc_intervals[at + 4u + i]; value.denominator[i] = rc_intervals[at + 4u + RC_R + i]; }
  return value;
}
fn rc_fail(at: u32, error: u32) { rc_receiver[at] = 0u; rc_receiver[at + 1u] |= error; }
fn rc_finalize_fail(at: u32, error: u32) {
  rc_fail(at, error);
  // Selection and energy validation are separate dispatches. Failed pending
  // states expose no selected state or residual, just as the final result did.
  for (var i = 9u; i < 13u; i++) { rc_receiver[at + i] = 0u; }
  for (var i = 0u; i < 2u * RC_SCALAR; i++) { rc_receiver[at + 32u + 7u * RC_SCALAR + i] = 0u; }
}
fn rc_interval_fail(at: u32, error: u32) { rc_intervals[at] = 0u; rc_intervals[at + 1u] |= error; }
fn rc_positive_projection(value: ExactRational) -> ExactRationalProjection {
  var projection = xr_project_f32_bits(value);
  // Positive subnormal bits remain a valid projection even on FTZ hardware.
  let positive_finite_bits = projection.bits > 0u && projection.bits < 0x7f800000u;
  if (value.negative != 0u || rc_zero(value) || !positive_finite_bits) { projection.error |= ${E.DOMAIN}u; }
  return projection;
}
fn rc_source_ready(row: u32, descriptor: u32, material: u32, phase: u32) -> bool {
  let at = row * 52u; let t0 = rc_vec(at + 8u); let fractions = rc_vec(at + 12u);
  let t2 = rc_vec(at + 16u); let velocity = rc_vec(at + 4u);
  if (phase < 1u || phase > 3u || t0.x != f32(material) || t0.y != f32(phase)
      || !all(abs(t0) <= vec4<f32>(3.402823e38)) || !all(abs(t2) <= vec4<f32>(3.402823e38))) { return false; }
  let expected = vec4<f32>(select(0.0, 1.0, phase == 1u), select(0.0, 1.0, phase == 2u), select(0.0, 1.0, phase == 3u), 0.0);
  let state = energy_phase_value(descriptor, f32(phase), velocity.w, false);
  return t2.z == 1.0 && all(fractions == expected) && state.z == 1.0 && state.x > 0.0
    && energy_finite(t0.z) && t0.w == state.y && abs(t0.z - state.x) <= 1.0e-4 * state.x
    && all(velocity == velocity) && all(abs(velocity) <= vec4<f32>(3.402823e38))
    && energy_relaxed_mechanics(rc_vec(at + 20u), rc_vec(at + 24u), rc_vec(at + 28u), rc_vec(at + 32u), rc_vec(at + 36u));
}
@compute @workgroup_size(1)
fn prepare_exact_receiver_caloric(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x; if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS;
  for (var i = 0u; i < RC_RS; i++) { rc_receiver[at + i] = 0u; }
  let row = rc_receiver_rows[index]; rc_receiver[at + 2u] = row;
  if (row == 0xffffffffu) { return; }
  if (row >= rc_params.quantity_count || row >= rc_params.physical_count
      || rc_params.reserved != 0u || rc_metadata[0u] != 0x58514331u || rc_metadata[1u] != 1u
      || rc_metadata[2u] != rc_params.material_count || rc_metadata[3u] != 8u
      || rc_metadata[4u] != rc_params.interval_count || rc_metadata[5u] != 8u
      || rc_metadata[6u] != rc_params.interval_offset || rc_metadata[7u] != 0u) { rc_fail(at, ${E.SOURCE_NOT_READY}u); return; }
  let q = row * RC_QSTRIDE;
  if (rc_quantities[q] != 1u || rc_quantities[q + 1u] != 0u || rc_quantities[q + 9u] != ${format.wordCount}u
      || rc_quantities[q + 10u] != RC_QR || rc_quantities[q + 11u] != 1u
      || rc_quantities[q + 5u] != RC_MERGED_CURRENT_KIND || rc_quantities[q + 6u] != row
      || rc_quantities[q + 7u] != 0xffffffffu || rc_quantities[q + 8u] != 0xffffffffu) { rc_fail(at, ${E.SOURCE_NOT_READY}u); return; }
  for (var i = 12u; i < 16u; i++) { if (rc_quantities[q + i] != 0u) { rc_fail(at, 8192u); return; } }
  let material = rc_quantities[q + 2u]; let phase = rc_quantities[q + 3u]; let molar = rc_quantities[q + 4u];
  var selected = 0xffffffffu;
  for (var i = 0u; i < rc_params.material_count; i++) {
    let record = 8u + i * 8u;
    if (rc_metadata[record] == material && rc_metadata[record + 1u] == phase) {
      if (selected != 0xffffffffu) { rc_fail(at, ${E.AMBIGUOUS}u); return; } selected = record;
    }
  }
  if (selected == 0xffffffffu || rc_metadata[selected + 2u] != molar || rc_metadata[selected + 6u] != 0u
      || rc_metadata[selected + 7u] != 0u) { rc_fail(at, ${E.SOURCE_NOT_READY}u); return; }
  let descriptor = rc_metadata[selected + 3u]; let first = rc_metadata[selected + 4u]; let count = rc_metadata[selected + 5u];
  if (descriptor == 0u || descriptor + 2u >= rc_params.graph_count || count == 0u || count > RC_INTERVALS
      || first > rc_params.interval_count || count > rc_params.interval_count - first
      || rc_graph[descriptor].x != f32(material) || bitcast<u32>(rc_graph[descriptor].z) != molar
      || !rc_source_ready(row, descriptor, material, phase)) { rc_fail(at, ${E.SOURCE_NOT_READY}u); return; }
  rc_receiver[at + 3u] = material; rc_receiver[at + 4u] = phase; rc_receiver[at + 5u] = molar;
  rc_receiver[at + 6u] = descriptor; rc_receiver[at + 7u] = first; rc_receiver[at + 8u] = count;
  var mass = xr_zero(); mass.exponent = ${format.quantumExponent};
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass.numerator[i] = rc_quantities[q + 16u + i]; }
  mass = xr_normalize(mass);
  rc_store(at + 32u, mass);
  if (mass.error != 0u) { rc_fail(at, mass.error); return; }
  rc_receiver[at] = 3u;
}
// A bounded call graph per dispatch avoids duplicating the wide rational
// arithmetic into one enormous driver program. Fields 4..6 are reused only
// before their final residuals exist; field 7 is cleared before search begins.
${[
  ['mass_view', `
  let projection = rc_positive_projection(rc_load(at + 32u));
  rc_receiver[at + 13u] = projection.bits; error |= projection.error;`],
  ['momentum_squared', `
  for (var axis = 0u; axis < 3u; axis++) {
    var p = rc_load_quantity(row, axis); var squared = xr_zero();
    xrp_rational_multiply(&squared, &p, &p);
    rc_store(at + 32u + (4u + axis) * RC_SCALAR, squared); error |= squared.error;
  }`],
  ['momentum_sum', `
  var sum = xr_zero();
  for (var axis = 0u; axis < 3u; axis++) {
    var squared = rc_load(at + 32u + (4u + axis) * RC_SCALAR); var next = xr_zero();
    xrp_rational_add(&next, &sum, &squared); sum = next;
  }
  rc_store(at + 32u + 2u * RC_SCALAR, sum); error |= sum.error;`],
  ['kinetic', `
  var squared = rc_load(at + 32u + 2u * RC_SCALAR); var mass = rc_load(at + 32u); var kinetic = xr_zero();
  xrp_rational_divide(&kinetic, &squared, &mass);
  let half = xr_scale_pow2(kinetic, -1);
  rc_store(at + 32u + 2u * RC_SCALAR, half); error |= half.error;`],
  ['internal', `
  var total = rc_load_quantity(row, 3u); var kinetic = rc_load(at + 32u + 2u * RC_SCALAR); var internal = xr_zero();
  xrp_rational_subtract(&internal, &total, &kinetic);
  rc_store(at + 32u + RC_SCALAR, internal); error |= internal.error;`],
  ['velocity', `
  var mass = rc_load(at + 32u);
  for (var axis = 0u; axis < 3u; axis++) {
    var momentum = rc_load_quantity(row, axis); var velocity = xr_zero();
    xrp_rational_divide(&velocity, &momentum, &mass);
    rc_store(at + 32u + (4u + axis) * RC_SCALAR, velocity); error |= velocity.error;
  }`],
  ['velocity_view', `
  for (var axis = 0u; axis < 3u; axis++) {
    var velocity = rc_load(at + 32u + (4u + axis) * RC_SCALAR);
    let projection = xrp_project_f32_bits(&velocity);
    // Signed zero may retain exact P; its underflow is consumed explicitly by
    // the downstream physical validator, as in the unsplit calculation.
    error |= projection.error & ~32u; rc_receiver[at + 23u] |= projection.error & 32u;
    rc_receiver[at + 14u + axis] = projection.bits;
  }`],
  ['view_momentum', `
  var mass = rc_load(at + 32u);
  for (var axis = 0u; axis < 3u; axis++) {
    var velocity = xr_zero(); xrp_from_f32_bits(&velocity, rc_receiver[at + 14u + axis]);
    var momentum = xr_zero(); xrp_rational_multiply(&momentum, &mass, &velocity);
    rc_store(at + 32u + (4u + axis) * RC_SCALAR, momentum); error |= momentum.error;
  }`],
  ['view_kinetic', `
  var sum = xr_zero();
  for (var axis = 0u; axis < 3u; axis++) {
    var momentum = rc_load(at + 32u + (4u + axis) * RC_SCALAR);
    var velocity = xr_zero(); xrp_from_f32_bits(&velocity, rc_receiver[at + 14u + axis]);
    var product = xr_zero(); xrp_rational_multiply(&product, &momentum, &velocity);
    var half = xr_scale_pow2(product, -1); var next = xr_zero();
    xrp_rational_add(&next, &sum, &half); sum = next;
  }
  rc_store(at + 32u + 3u * RC_SCALAR, sum); error |= sum.error;`],
  ['momentum_residual', `
  for (var axis = 0u; axis < 3u; axis++) {
    var momentum = rc_load_quantity(row, axis);
    var view = rc_load(at + 32u + (4u + axis) * RC_SCALAR); var residual = xr_zero();
    xrp_rational_subtract(&residual, &momentum, &view);
    rc_store(at + 32u + (4u + axis) * RC_SCALAR, residual); error |= residual.error;
  }`],
  ['volume_identity', `
  var rest = rc_load_quantity(row, 4u); var current = rc_load_quantity(row, 5u);
  let same = rc_compare(rest, current); error |= same.error;
  if (same.value != 0) { error |= ${E.SOURCE_NOT_READY}u; }`],
  ['volume_ratio', `
  var rest = rc_load_quantity(row, 4u); var current = rc_load_quantity(row, 5u);
  var j = xr_zero(); xrp_rational_divide(&j, &current, &rest);
  rc_store(at + 32u + 7u * RC_SCALAR, j); error |= j.error;`],
  ['volume_views', `
  for (var field = 0u; field < 3u; field++) {
    let projection = rc_positive_projection(rc_load_quantity(row, 4u + field));
    rc_receiver[at + 17u + field] = projection.bits; error |= projection.error;
  }
  let projection = rc_positive_projection(rc_load(at + 32u + 7u * RC_SCALAR));
  rc_receiver[at + 20u] = projection.bits; error |= projection.error;
  if (projection.bits != 0x3f800000u) { error |= ${E.SOURCE_NOT_READY}u; }`],
  ['moles', `
  var mass = rc_load(at + 32u); var molar = xr_zero(); xrp_from_f32_bits(&molar, rc_receiver[at + 5u]);
  var moles = xr_zero(); xrp_rational_divide(&moles, &mass, &molar);
  rc_store(at + 32u + 7u * RC_SCALAR, moles); error |= moles.error;`],
  ['entities', `
  var moles = rc_load(at + 32u + 7u * RC_SCALAR); var avogadro = xr_zero();
  ${avogadroWords.map((word, i) => `avogadro.numerator[${i}u] = ${word}u;`).join('\n  ')}
  var entities = xr_zero(); xrp_rational_multiply(&entities, &moles, &avogadro);
  rc_store(at + 32u + 7u * RC_SCALAR, entities); error |= entities.error;`],
  ['finish', `
  let projection = rc_positive_projection(rc_load(at + 32u + 7u * RC_SCALAR));
  rc_receiver[at + 21u] = projection.bits; error |= projection.error;
  for (var i = 0u; i < RC_SCALAR; i++) { rc_receiver[at + 32u + 7u * RC_SCALAR + i] = 0u; }
  if (error == 0u) { rc_receiver[at] = 2u; }`]
].map(([name, body]) => `
@compute @workgroup_size(1)
fn prepare_exact_receiver_${name}(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x; if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS; if (rc_receiver[at] != 3u) { return; }
  let row = rc_receiver[at + 2u]; var error = 0u;
${body}
  if (error != 0u) { rc_fail(at, error); }
}`).join('\n')}

fn rc_residual(at: u32, interval: u32, temperature: u32) -> ExactRational {
  let phase = rc_receiver[at + 4u];
  let state = energy_phase_value(rc_params.graph_count + interval * 2u, f32(phase), bitcast<f32>(temperature), true);
  if (state.z != 1.0 || state.w != f32(phase) || !(state.y > 0.0) || !energy_finite(state.y)) { return xr_failure(${E.DOMAIN}u); }
  return xr_subtract(rc_load(at + 32u + RC_SCALAR), xr_multiply(rc_load(at + 32u), xr_from_f32_bits(bitcast<u32>(state.x))));
}
@compute @workgroup_size(1)
fn initialize_exact_receiver_caloric_intervals(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x / RC_INTERVALS; let slot = id.x % RC_INTERVALS;
  if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS; let dest = id.x * RC_IS;
  for (var i = 0u; i < RC_IS; i++) { rc_intervals[dest + i] = 0u; }
  if (rc_receiver[at] != 2u || slot >= rc_receiver[at + 8u]) { return; }
  let interval = rc_receiver[at + 7u] + slot;
  rc_intervals[dest + 2u] = index; rc_intervals[dest + 3u] = interval; rc_intervals[dest + 14u] = 1u;
  let metadata = rc_params.interval_offset + interval * 8u;
  let curve = rc_metadata[metadata + 5u];
  if (curve + 1u >= rc_params.graph_count || u32(f32(curve)) != curve || rc_metadata[metadata + 6u] != 0u || rc_metadata[metadata + 7u] != 0u) { rc_interval_fail(dest, ${E.INCONSISTENT_GRAPH}u); return; }
  let shape = rc_graph[curve]; let domain = rc_graph[curve + 1u];
  let original_list = rc_graph[rc_receiver[at + 6u] + 1u]; var belongs = false;
  for (var i = 0u; i < u32(original_list.y); i++) {
    belongs = belongs || curve == u32(original_list.x) + 2u * i;
  }
  if (!belongs) { rc_interval_fail(dest, ${E.INCONSISTENT_GRAPH}u); return; }
  if (shape.x != f32(rc_receiver[at + 4u]) || bitcast<u32>(shape.w) != rc_metadata[metadata + 4u]
      || any(bitcast<vec4<u32>>(domain) != vec4<u32>(rc_metadata[metadata], rc_metadata[metadata + 1u], rc_metadata[metadata + 2u], rc_metadata[metadata + 3u]))) {
    rc_interval_fail(dest, ${E.INCONSISTENT_GRAPH}u); return;
  }
  if (!energy_finite(domain.x) || !energy_finite(domain.y) || !(domain.y > domain.x)) {
    rc_interval_fail(dest, ${E.DOMAIN}u); return;
  }
  // Original source readiness requires positive T; an unrelated interval
  // wholly outside positive T is visited but cannot supply a physical state.
  if (!(domain.y > 0.0)) { return; }
  let lo = select(bitcast<u32>(domain.x), 1u, domain.x <= 0.0); let hi = bitcast<u32>(domain.y);
  let lower = rc_residual(at, interval, lo); let upper = rc_residual(at, interval, hi);
  let lower_sign = rc_compare(lower, xr_zero()); let upper_sign = rc_compare(upper, xr_zero());
  let monotone = rc_compare(lower, upper); let error = lower.error | upper.error | lower_sign.error | upper_sign.error | monotone.error;
  if (error != 0u) { rc_interval_fail(dest, error); return; }
  if (monotone.value < 0) { rc_interval_fail(dest, ${E.INCONSISTENT_GRAPH}u); return; }
  // An interval outside the exact target is simply inapplicable. Another
  // original interval may contain it; the whole original union is considered.
  if (lower_sign.value < 0 || upper_sign.value > 0) { return; }
  rc_intervals[dest + 2u] = index; rc_intervals[dest + 3u] = interval;
  rc_intervals[dest + 4u] = lo; rc_intervals[dest + 5u] = hi;
  rc_store_interval(dest + 16u, lower); rc_store_interval(dest + 16u + RC_SCALAR, upper);
  rc_intervals[dest] = 3u;
}
@compute @workgroup_size(1)
fn refine_exact_receiver_caloric_intervals(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x / RC_INTERVALS; if (index >= rc_params.receiver_count) { return; }
  let dest = id.x * RC_IS; if (rc_intervals[dest] != 3u) { return; }
  let lo = rc_intervals[dest + 4u]; let hi = rc_intervals[dest + 5u]; if (hi - lo <= 1u) { return; }
  let mid = lo + (hi - lo) / 2u; let at = index * RC_RS;
  let residual = rc_residual(at, rc_intervals[dest + 3u], mid);
  let lower = rc_compare(residual, rc_load_interval(dest + 16u)); let upper = rc_compare(residual, rc_load_interval(dest + 16u + RC_SCALAR));
  let sign = rc_compare(residual, xr_zero()); let error = residual.error | lower.error | upper.error | sign.error;
  if (error != 0u) { rc_interval_fail(dest, error); return; }
  if (lower.value > 0 || upper.value < 0) { rc_interval_fail(dest, ${E.INCONSISTENT_GRAPH}u); return; }
  rc_intervals[dest + 7u]++;
  if (sign.value >= 0) { rc_intervals[dest + 4u] = mid; rc_store_interval(dest + 16u, residual); }
  if (sign.value <= 0) { rc_intervals[dest + 5u] = mid; rc_store_interval(dest + 16u + RC_SCALAR, residual); }
}
fn rc_full_state(at: u32, temperature: u32) -> vec4<f32> {
  let descriptor = rc_receiver[at + 6u]; let phase = f32(rc_receiver[at + 4u]); let t = bitcast<f32>(temperature);
  if (!(t > 0.0) || !energy_finite(t)) { return vec4<f32>(0.0); }
  let forward = energy_phase_value(descriptor, phase, t, true);
  if (forward.z != 1.0 || forward.w != phase || !(forward.y > 0.0) || !energy_finite(forward.y)) { return vec4<f32>(0.0); }
  let inverse = energy_phase_value(descriptor, phase, forward.x, false);
  // Original source readiness uses this same relative cached-T rule. The exact
  // extensive comparison and residual do not acquire a tolerance.
  if (inverse.z != 1.0 || inverse.w != phase || !(inverse.x > 0.0) || forward.y != inverse.y
      || abs(t - inverse.x) > 1.0e-4 * inverse.x) { return vec4<f32>(0.0); }
  return forward;
}
@compute @workgroup_size(1)
fn select_exact_receiver_caloric(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x; if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS; if (rc_receiver[at] != 2u) { return; }
  var found = false; var chosen_t = 0u; var chosen_u = 0u; var chosen_rho = 0u;
  var chosen_interval = 0u;
  for (var slot = 0u; slot < rc_receiver[at + 8u]; slot++) {
    let dest = (index * RC_INTERVALS + slot) * RC_IS;
    if (rc_intervals[dest + 14u] != 1u || rc_intervals[dest + 2u] != index
        || rc_intervals[dest + 3u] != rc_receiver[at + 7u] + slot) {
      rc_finalize_fail(at, ${E.INCOMPLETE_SEARCH}u); return;
    }
    if (rc_intervals[dest + 1u] != 0u) { rc_finalize_fail(at, rc_intervals[dest + 1u]); return; }
    if (rc_intervals[dest] == 0u) { continue; }
    if (rc_intervals[dest] != 3u || rc_intervals[dest + 2u] != index) { rc_finalize_fail(at, ${E.INCOMPLETE_SEARCH}u); return; }
    let lo = rc_intervals[dest + 4u]; let hi = rc_intervals[dest + 5u];
    if (hi < lo || hi - lo > 1u) { rc_finalize_fail(at, ${E.INCOMPLETE_SEARCH}u); return; }
    var lower = rc_load_interval(dest + 16u); var upper = rc_load_interval(dest + 16u + RC_SCALAR);
    lower.negative = 0u; upper.negative = 0u; let side = rc_compare(lower, upper);
    if (side.error != 0u) { rc_finalize_fail(at, side.error); return; }
    let low = side.value < 0 || (side.value == 0 && (lo & 1u) == 0u); let temperature = select(hi, lo, low);
    let state = rc_full_state(at, temperature);
    // Probe descriptors never authorize a state. An ambiguous selected point is
    // invalid; valid interiors remain searchable despite ambiguous endpoints.
    if (state.z != 1.0) { continue; }
    let stored = xr_subtract(rc_load(at + 32u + RC_SCALAR), xr_multiply(rc_load(at + 32u), xr_from_f32_bits(bitcast<u32>(state.x))));
    let same = rc_compare(stored, rc_load_interval(dest + 16u + select(RC_SCALAR, 0u, low)));
    if (stored.error != 0u || same.error != 0u || same.value != 0) { rc_finalize_fail(at, stored.error | same.error | ${E.INCONSISTENT_GRAPH}u); return; }
    if (found && (chosen_t != temperature || chosen_u != bitcast<u32>(state.x) || chosen_rho != bitcast<u32>(state.y))) {
      rc_finalize_fail(at, ${E.AMBIGUOUS}u); return;
    }
    found = true; chosen_t = temperature; chosen_u = bitcast<u32>(state.x); chosen_rho = bitcast<u32>(state.y);
    chosen_interval = rc_intervals[dest + 3u];
    rc_store(at + 32u + 7u * RC_SCALAR, stored);
  }
  if (!found) { rc_finalize_fail(at, ${E.DOMAIN}u); return; }
  rc_receiver[at + 9u] = chosen_interval; rc_receiver[at + 10u] = chosen_t;
  rc_receiver[at + 11u] = chosen_u; rc_receiver[at + 12u] = chosen_rho;
  // Pending selection. Only the final consistency dispatch may publish ready=1.
  rc_receiver[at] = 3u;
}
@compute @workgroup_size(1)
fn prepare_exact_receiver_caloric_view_energy(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x; if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS; if (rc_receiver[at] != 3u) { return; }
  let chosen_u = rc_receiver[at + 11u];
  let row = rc_receiver[at + 2u]; let product_internal = xr_multiply(rc_load(at + 32u), xr_from_f32_bits(chosen_u));
  let view_energy = xr_add(product_internal, rc_load(at + 32u + 3u * RC_SCALAR));
  let retained_residual = xr_subtract(rc_load_quantity(row, 3u), view_energy);
  rc_store(at + 32u + 8u * RC_SCALAR, retained_residual);
  rc_receiver[at] = 4u;
}
@compute @workgroup_size(1)
fn finalize_exact_receiver_caloric(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x; if (index >= rc_params.receiver_count) { return; }
  let at = index * RC_RS; if (rc_receiver[at] != 4u) { return; }
  let chosen_residual = rc_load(at + 32u + 7u * RC_SCALAR);
  let retained_residual = rc_load(at + 32u + 8u * RC_SCALAR);
  let corrected = xr_add(chosen_residual, xr_subtract(rc_load(at + 32u + 2u * RC_SCALAR), rc_load(at + 32u + 3u * RC_SCALAR)));
  let consistent = rc_compare(retained_residual, corrected);
  if (retained_residual.error != 0u || consistent.error != 0u || consistent.value != 0) { rc_finalize_fail(at, retained_residual.error | consistent.error | ${E.INCONSISTENT_GRAPH}u); return; }
  rc_store(at + 32u + 7u * RC_SCALAR, chosen_residual); rc_store(at + 32u + 8u * RC_SCALAR, retained_residual);
  // Numeric preparation only. Original quantities remain read-only. Existing
  // placement terminal coverage, chemistry, S/T/M writes and rollback still own
  // physical admission; this receipt grants none of those permissions.
  rc_receiver[at] = 1u;
}
`;
}
