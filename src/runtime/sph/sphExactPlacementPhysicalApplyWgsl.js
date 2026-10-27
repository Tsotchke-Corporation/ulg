import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphReactionEnergyGraphWgsl } from '../../../ulg-gpu-abi/src/sphReactionEnergyWgsl.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { originalExactPhysicalHelpers } from './originalPhysicalHelpers.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as RECEIPT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

export const SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC = 0x58504131;
// Ordered passes share one private evidence row and one command encoder.
export const SPH_EXACT_PHYSICAL_PREPARATION_STAGES = Object.freeze([
  Object.freeze({ key: 'physicalSource', label: 'physical-source', entryPoint: 'validate_exact_receiver_physical_source' }),
  Object.freeze({ key: 'physicalVolume', label: 'physical-volume', entryPoint: 'validate_exact_receiver_volume' }),
  Object.freeze({ key: 'physicalOldVolumeIdentity', label: 'physical-old-volume-identity', entryPoint: 'validate_exact_receiver_old_volume_identity' }),
  Object.freeze({ key: 'physicalRestDelta', label: 'physical-rest-delta', entryPoint: 'validate_exact_receiver_rest_delta' }),
  Object.freeze({ key: 'physicalVolumeDelta', label: 'physical-volume-delta', entryPoint: 'validate_exact_receiver_volume_delta' }),
  Object.freeze({ key: 'physicalVolumeClosure', label: 'physical-volume-closure', entryPoint: 'validate_exact_receiver_volume_closure' }),
  Object.freeze({ key: 'physicalVolumeViews', label: 'physical-volume-views', entryPoint: 'validate_exact_receiver_volume_views' }),
  Object.freeze({ key: 'physicalMomentumX', label: 'physical-momentum-x', entryPoint: 'validate_exact_receiver_momentum_x' }),
  Object.freeze({ key: 'physicalMomentumY', label: 'physical-momentum-y', entryPoint: 'validate_exact_receiver_momentum_y' }),
  Object.freeze({ key: 'physicalMomentumZ', label: 'physical-momentum-z', entryPoint: 'validate_exact_receiver_momentum_z' }),
  Object.freeze({ key: 'physicalKinetic', label: 'physical-kinetic', entryPoint: 'validate_exact_receiver_kinetic' }),
  Object.freeze({ key: 'physicalEnergyView', label: 'physical-energy-view', entryPoint: 'validate_exact_receiver_energy_view' }),
  Object.freeze({ key: 'physicalEntities', label: 'physical-entities', entryPoint: 'validate_exact_receiver_entities' }),
  Object.freeze({ key: 'physicalPrepare', label: 'physical-prepare', entryPoint: 'prepare_exact_receiver_physical_segment_tails' })
]);

const checked = (v, name) => {
  if (!Number.isSafeInteger(v) || v < 1 || v > 0x3fffffff) throw RangeError(`Exact apply ${name} exceeds word addressing`);
  return v;
};
export function sphExactPlacementPhysicalApplyLayout(format, quantity, caloric, capture,
  { currentRowOffset = quantity.currentRowOffset } = {}) {
  validateSphExactMassFormat(format);
  const p = checked(quantity.particleCount, 'particles'), e = checked(quantity.eventCapacity, 'events');
  if (quantity.massWordCount !== format.wordCount || quantity.scalarOffsetWords !== 16 + format.wordCount
      || quantity.scalar.recordWords !== 4 + 2 * quantity.scalar.wordCount
      || quantity.recordWords !== quantity.scalarOffsetWords + 7 * quantity.scalar.recordWords
      || caloric.scalar.wordCount < quantity.scalar.wordCount
      || caloric.scalar.recordWords !== 4 + 2 * caloric.scalar.wordCount
      || caloric.receiverRecordWords !== 32 + 9 * caloric.scalar.recordWords || caloric.receiverCapacity < e
      || capture.recordWords !== 16 + format.wordCount + 10 * quantity.scalar.recordWords
      || ![0, p].includes(currentRowOffset)) throw TypeError('Matching original quantity/caloric/capture layouts required');
  const evidenceRecordWords = checked(8 + caloric.receiverRecordWords, 'evidence stride');
  return Object.freeze({ particleCount: p, eventCapacity: e, currentRowOffset,
    currentWordLength: checked((currentRowOffset + p) * quantity.recordWords, 'source current words'),
    outputQuantityWordLength: checked(p * quantity.recordWords, 'output current words'),
    evidenceRecordWords, evidenceWordLength: checked(p * evidenceRecordWords, 'evidence words'),
    mapWordLength: checked(e + 4 * p, 'merge map words'),
    captureWordLength: checked(e * capture.recordWords, 'capture words'),
    caloricWordLength: checked(e * caloric.receiverRecordWords, 'caloric words'),
    packedPhysicalWordLength: checked(p * 52, 'packed physical words'),
    candidateRecordWords: 56, candidateWordLength: checked(p * 56, 'candidate words'),
    uniformBytes: 80, prepareStorageBindingCount: 12, applyStorageBindingCount: 9, workgroupSize: 1 });
}
export function assertSphExactPlacementPhysicalApplyDeviceLimits(layout, limits, { mechanicsRecordCount, graphRecordCount } = {}) {
  checked(mechanicsRecordCount, 'mechanics binding records'); checked(graphRecordCount, 'graph binding records');
  if (!limits || !['maxStorageBuffersPerShaderStage', 'maxBindingsPerBindGroup', 'maxUniformBufferBindingSize',
      'maxStorageBufferBindingSize', 'maxBufferSize'].every(key => Number.isSafeInteger(limits[key]) && limits[key] > 0) || limits.maxStorageBuffersPerShaderStage < layout.prepareStorageBindingCount
      || limits.maxBindingsPerBindGroup < layout.prepareStorageBindingCount + 1
      || limits.maxUniformBufferBindingSize < layout.uniformBytes
      || !Number.isSafeInteger(limits.maxStorageBufferBindingSize) || !Number.isSafeInteger(limits.maxBufferSize)) {
    throw RangeError('Existing device cannot bind exact physical preparation');
  }
  for (const words of [layout.currentWordLength, layout.outputQuantityWordLength, layout.evidenceWordLength,
    layout.candidateWordLength, layout.mapWordLength, layout.captureWordLength, layout.caloricWordLength,
    layout.packedPhysicalWordLength, checked(mechanicsRecordCount * 4, 'mechanics words'), checked(graphRecordCount * 4, 'graph words')]) {
    if (words * 4 > limits.maxStorageBufferBindingSize || words * 4 > limits.maxBufferSize) {
      throw RangeError('Exact physical preparation arena exceeds existing device capacity');
    }
  }
  return true;
}
export function planSphExactPlacementPhysicalApplyDispatches(layout, limits) {
  const limit = limits?.maxComputeWorkgroupsPerDimension;
  if (!Number.isSafeInteger(limit) || limit < 1) throw RangeError('Original device workgroup limit required');
  const tile = count => {
    const x = Math.min(count, limit), y = Math.ceil(count / x);
    if (y > limit) throw RangeError('Exact physical dispatch exceeds original two-dimensional workgroup capacity');
    return Object.freeze([x, y, 1]);
  };
  return Object.freeze([
    Object.freeze({ stage: 'prepare', entryPoint: 'initialize_exact_receiver_physical_apply', groups: tile(layout.particleCount) }),
    ...SPH_EXACT_PHYSICAL_PREPARATION_STAGES.map(({ entryPoint }) =>
      Object.freeze({ stage: 'prepare', entryPoint, groups: tile(layout.eventCapacity) })),
    Object.freeze({ stage: 'apply', entryPoint: 'apply_exact_receiver_physical_segment_tails', groups: tile(layout.particleCount) })
  ]);
}
// Pure shape encoder. The genuine placement owner still admits original tables,
// immutable source tuples, aliases, counts and generation before every await.
export function encodeSphExactPlacementPhysicalApplyParams(layout, placementWords, {
  phaseRecordCount, gasConstitutiveOffset, graphRecordCount
}) {
  if (!(placementWords instanceof Uint32Array) || placementWords.length !== 16
      || placementWords[0] !== layout.particleCount || placementWords[1] !== layout.eventCapacity
      || placementWords[3] !== 2 || placementWords[4] !== 3 || placementWords[5] !== 8
      || placementWords[15] !== SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION) {
    throw TypeError('Unchanged original packed placement parameters required');
  }
  checked(phaseRecordCount, 'phase records'); checked(graphRecordCount, 'graph records');
  if (!Number.isSafeInteger(gasConstitutiveOffset) || gasConstitutiveOffset < 0
      || gasConstitutiveOffset > 0x3fffffff
      || (gasConstitutiveOffset !== 0 && gasConstitutiveOffset < phaseRecordCount * 3)) {
    throw RangeError('Original gas tail must follow original phase records');
  }
  checked(Math.max(phaseRecordCount * 3, gasConstitutiveOffset + phaseRecordCount), 'mechanics records');
  const result = new Uint32Array(20); result.set(placementWords);
  result.set([phaseRecordCount, gasConstitutiveOffset, graphRecordCount, layout.currentRowOffset], 16);
  return result;
}
export function createSphExactPlacementPhysicalApplyWgsl(format, quantity, caloric, capture, options = {}) {
  const l = sphExactPlacementPhysicalApplyLayout(format, quantity, caloric, capture, options);
  if (options.stage === 'apply') return createRawApplyWgsl(l, quantity, caloric);
  if (options.stage !== undefined && options.stage !== 'prepare') throw TypeError('Unknown exact physical apply stage');
  const helper = originalExactPhysicalHelpers();
  // Preserve the original 64-byte prefix and every original helper expression;
  // append only table/arena addressing fields to the uniform declaration.
  const close = helper.placementStruct.lastIndexOf('}');
  const paramsStruct = helper.placementStruct.slice(0, close)
    + '  phase_record_count: u32,\n  gas_constitutive_offset: u32,\n  graph_record_count: u32,\n  current_row_offset: u32,\n'
    + helper.placementStruct.slice(close);
  // Every arithmetic input is a normalized quantity/caloric/scratch load, a
  // checked f32 constructor, or a prior canonical result. Raw quantity loads
  // are confined to xp_equal_rationals, which validates them independently.
  return createSphExactRationalQuantityWgsl({ wordCount: caloric.scalar.wordCount, canonicalOperands: true })
    + createSphReactionEnergyGraphWgsl({ record: index => `xp_graph[${index}]` })
    + helper.gas + '\n' + helper.phaseStruct + '\n' + paramsStruct + '\n'
    + helper.mechanics.join('\n') + '\n' + helper.placement.join('\n') + /* wgsl */ `
const XP_P: u32 = ${l.particleCount}u;
const XP_E: u32 = ${l.eventCapacity}u;
const XP_N: u32 = ${format.wordCount}u;
const XP_R: u32 = ${caloric.scalar.wordCount}u;
const XP_QR: u32 = ${quantity.scalar.wordCount}u;
const XP_Q: u32 = ${quantity.recordWords}u;
const XP_QS: u32 = ${quantity.scalar.recordWords}u;
const XP_QOFF: u32 = ${quantity.scalarOffsetWords}u;
const XP_CS: u32 = ${caloric.scalar.recordWords}u;
const XP_C: u32 = ${caloric.receiverRecordWords}u;
const XP_CAPTURE: u32 = ${capture.recordWords}u;
const XP_EVIDENCE: u32 = ${l.evidenceRecordWords}u;
const XP_MAGIC: u32 = ${SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC}u;
const XP_INVALID: u32 = 0xffffffffu;
@group(0) @binding(0) var<storage, read> xp_physical: array<u32>;
@group(0) @binding(1) var<storage, read> xp_current: array<u32>;
@group(0) @binding(2) var<storage, read> xp_merged: array<u32>;
@group(0) @binding(3) var<storage, read> xp_map: array<u32>;
@group(0) @binding(4) var<storage, read> xp_caloric: array<u32>;
@group(0) @binding(5) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> xp_graph: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> xp_capture: array<u32>;
@group(0) @binding(8) var<storage, read> reduced_values: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> xp_candidate: array<u32>;
@group(0) @binding(10) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(11) var<storage, read_write> xp_evidence: array<u32>;
@group(0) @binding(12) var<uniform> params: ProductPlacementParams;
fn xp_flag(flag: u32) {
  if (arrayLength(&receipt) > ${RECEIPT.overflowFlags}u) { atomicOr(&receipt[${RECEIPT.overflowFlags}u], flag); }
}
fn xp_fail(receiver: u32, tail: u32, error: u32, flag: u32) {
  xp_flag(flag);
  if (receiver < XP_P && arrayLength(&xp_evidence) >= ${l.evidenceWordLength}u) {
    let at = receiver * XP_EVIDENCE;
    xp_evidence[at] = XP_MAGIC; xp_evidence[at + 1u] = 1u;
    xp_evidence[at + 2u] = 3u; xp_evidence[at + 3u] |= error;
    xp_evidence[at + 4u] = receiver; xp_evidence[at + 5u] = tail;
  }
}
fn xp_bounds() -> bool {
  return params.particle_count == XP_P && params.event_row_count == XP_E
    && params.state_stride_vec4 == 2u && params.thermo_stride_vec4 == 3u && params.mechanics_stride_vec4 == 8u
    && params.current_row_offset == ${l.currentRowOffset}u && params.receipt_version == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u
    && params.phase_record_count > 0u && params.phase_record_count <= arrayLength(&material_phase_records) / 3u
    && (params.gas_constitutive_offset == 0u || (params.gas_constitutive_offset >= params.phase_record_count * 3u
      && params.gas_constitutive_offset <= arrayLength(&material_phase_records)
      && params.phase_record_count <= arrayLength(&material_phase_records) - params.gas_constitutive_offset))
    && params.graph_record_count > 0u && params.graph_record_count <= arrayLength(&xp_graph)
    && arrayLength(&xp_physical) >= ${l.packedPhysicalWordLength}u
    && arrayLength(&xp_current) >= ${l.currentWordLength}u && arrayLength(&xp_merged) >= ${l.outputQuantityWordLength}u
    && arrayLength(&xp_map) >= ${l.mapWordLength}u && arrayLength(&xp_caloric) >= ${l.caloricWordLength}u
    && arrayLength(&xp_capture) >= ${l.captureWordLength}u && arrayLength(&reduced_values) >= XP_E * 6u
    && arrayLength(&xp_candidate) >= ${l.candidateWordLength}u && arrayLength(&receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u
    && arrayLength(&xp_evidence) >= ${l.evidenceWordLength}u;
}
fn xp_vec(at: u32) -> vec4<f32> {
  return bitcast<vec4<f32>>(vec4<u32>(xp_physical[at], xp_physical[at + 1u], xp_physical[at + 2u], xp_physical[at + 3u]));
}
fn xp_zero(value: ExactRational) -> bool {
  for (var i = 0u; i < XP_R; i++) { if (value.numerator[i] != 0u) { return false; } } return true;
}
fn xp_equal(a: ExactRational, b: ExactRational) -> u32 {
  // All callers supply normalized loads or checked arithmetic results. Their
  // canonical signed odd numerator/denominator and exponent uniquely identify
  // the value; forming and reducing a difference adds no equality evidence.
  var error = a.error | b.error;
  if (a.negative != b.negative || a.exponent != b.exponent || a.reserved != 0u || b.reserved != 0u) { error |= 8192u; }
  for (var i = 0u; i < XP_R; i++) {
    if (a.numerator[i] != b.numerator[i] || a.denominator[i] != b.denominator[i]) { error |= 8192u; }
  }
  return error;
}
fn xp_positive(value: ExactRational) -> bool { return value.error == 0u && value.negative == 0u && !xp_zero(value); }
fn xp_quantity_raw(at: u32, merged: bool) -> ExactRational {
  var value = xr_zero();
  if (merged) {
    value.negative = xp_merged[at]; value.error = xp_merged[at + 1u];
    value.exponent = bitcast<i32>(xp_merged[at + 2u]); value.reserved = xp_merged[at + 3u];
    for (var i = 0u; i < XP_QR; i++) { value.numerator[i] = xp_merged[at + 4u + i]; value.denominator[i] = xp_merged[at + 4u + XP_QR + i]; }
  } else {
    value.negative = xp_current[at]; value.error = xp_current[at + 1u];
    value.exponent = bitcast<i32>(xp_current[at + 2u]); value.reserved = xp_current[at + 3u];
    for (var i = 0u; i < XP_QR; i++) { value.numerator[i] = xp_current[at + 4u + i]; value.denominator[i] = xp_current[at + 4u + XP_QR + i]; }
  }
  return value;
}
fn xp_quantity(at: u32, merged: bool) -> ExactRational {
  return xr_normalize(xp_quantity_raw(at, merged));
}
// Exact equality does not require reducing either fraction by its odd GCD.
// Validate both representations, extract their binary powers, then compare
// cross-products in the existing 2*R+1-limb scratch capacity. Each product of
// two R-limb operands fits that capacity. This also admits equivalent valid
// non-canonical inputs; it never substitutes a floating-point comparison.
fn xp_equal_rationals(left: ExactRational, right: ExactRational) -> u32 {
  var a = left; var b = right;
  var an: ExactRationalWide; var ad: ExactRationalWide;
  var bn: ExactRationalWide; var bd: ExactRationalWide;
  xrp_numerator(&an, &a); xrp_denominator(&ad, &a);
  xrp_numerator(&bn, &b); xrp_denominator(&bd, &b);
  let az = xrp_top(&an) < 0; let bz = xrp_top(&bn) < 0;
  var error = a.error | b.error;
  if (a.negative > 1u || b.negative > 1u || a.reserved != 0u || b.reserved != 0u
      || (az && a.negative != 0u) || (bz && b.negative != 0u)) { error |= 8192u; }
  if (xrp_top(&ad) < 0 || xrp_top(&bd) < 0) { error |= 4096u; }
  if (error != 0u) { return error; }
  var ant = 0u; var adt = 0u; var bnt = 0u; var bdt = 0u;
  var ae = ExactRationalExponent(0, 0u); var be = ExactRationalExponent(0, 0u);
  if (!az) {
    ant = xrp_trailing(&an); adt = xrp_trailing(&ad);
    ae = xr_exponent_add(a.exponent, i32(ant) - i32(adt));
  }
  if (!bz) {
    bnt = xrp_trailing(&bn); bdt = xrp_trailing(&bd);
    be = xr_exponent_add(b.exponent, i32(bnt) - i32(bdt));
  }
  error |= ae.error | be.error;
  if (error != 0u) { return error; }
  if (az || bz) { return select(8192u, 0u, az && bz); }
  if (ae.value != be.value || a.negative != b.negative) { return 8192u; }
  xrp_shift_right(&an, ant); xrp_shift_right(&ad, adt);
  xrp_shift_right(&bn, bnt); xrp_shift_right(&bd, bdt);
  var ap: ExactRationalWide; var bp: ExactRationalWide;
  xrp_multiply(&ap, &an, &bd); xrp_multiply(&bp, &bn, &ad);
  return ap.error | bp.error | select(8192u, 0u, xrp_compare(&ap, &bp) == 0);
}
fn xp_mass(at: u32, merged: bool) -> ExactRational {
  var value = xr_zero(); value.exponent = ${format.quantumExponent};
  for (var i = 0u; i < XP_N; i++) {
    if (merged) { value.numerator[i] = xp_merged[at + 16u + i]; }
    else { value.numerator[i] = xp_current[at + 16u + i]; }
  }
  return xr_normalize(value);
}
fn xp_caloric_value(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = xp_caloric[at]; value.error = xp_caloric[at + 1u];
  value.exponent = bitcast<i32>(xp_caloric[at + 2u]); value.reserved = xp_caloric[at + 3u];
  for (var i = 0u; i < XP_R; i++) { value.numerator[i] = xp_caloric[at + 4u + i]; value.denominator[i] = xp_caloric[at + 4u + XP_R + i]; }
  return xr_normalize(value);
}
fn xp_project_matches(value: ExactRational, bits: u32, positive: bool) -> u32 {
  let projection = xr_project_f32_bits(value);
  var error = projection.error;
  if (!positive) { error &= ~32u; }
  if (projection.bits != bits || (positive && (!xp_positive(value) || bits == 0u || bits >= 0x7f800000u))) { error |= 8192u; }
  return error;
}
// A fresh pending owner allocates zero evidence. Repeated/late initialization
// can never erase a failure or disguise a previously completed apply.
@compute @workgroup_size(1)
fn initialize_exact_receiver_physical_apply(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let row = id.x + id.y * groups.x; if (row >= XP_P) { return; }
  if (!xp_bounds()) { xp_flag(${FLAGS.CONSERVATION_MOMENT}u); return; }
  let at = row * XP_EVIDENCE; var dirty = false;
  for (var i = 0u; i < XP_EVIDENCE; i++) { dirty = dirty || xp_evidence[at + i] != 0u; }
  for (var i = 0u; i < 56u; i++) { dirty = dirty || xp_candidate[row * 56u + i] != 0u; }
  if (dirty) { xp_fail(row, XP_INVALID, 8192u, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  xp_evidence[at] = XP_MAGIC; xp_evidence[at + 1u] = 1u; xp_evidence[at + 2u] = 1u;
  xp_evidence[at + 4u] = row; xp_evidence[at + 5u] = XP_INVALID;
}
// Private pending stages reuse the evidence payload as exact scratch. The
// final prepare replaces it with the complete caloric evidence. Neither raw
// apply nor publication admits these intermediate states.
fn xp_stage_row(position: u32, expected: u32) -> u32 {
  if (position >= XP_E) { return XP_INVALID; }
  if (!xp_bounds()) { xp_flag(${FLAGS.CONSERVATION_MOMENT}u); return XP_INVALID; }
  let row = xp_map[position]; if (row == XP_INVALID) { return XP_INVALID; }
  if (row >= XP_P) { xp_flag(${FLAGS.CONSERVATION_MOMENT}u); return XP_INVALID; }
  let ev = row * XP_EVIDENCE;
  if (xp_evidence[ev] != XP_MAGIC || xp_evidence[ev + 1u] != 1u || xp_evidence[ev + 2u] != expected
      || xp_evidence[ev + 3u] != 0u || xp_evidence[ev + 4u] != row || xp_evidence[ev + 5u] != position
      || xp_evidence[ev + 6u] != 0u || xp_evidence[ev + 7u] != 0u) {
    xp_fail(row, position, 8192u, ${FLAGS.CONSERVATION_MOMENT}u); return XP_INVALID;
  }
  return row;
}
fn xp_scratch_load(ev: u32, field: u32) -> ExactRational {
  let at = ev + 8u + 32u + field * XP_CS;
  var value = xr_zero(); value.negative = xp_evidence[at]; value.error = xp_evidence[at + 1u];
  value.exponent = bitcast<i32>(xp_evidence[at + 2u]); value.reserved = xp_evidence[at + 3u];
  for (var i = 0u; i < XP_R; i++) {
    value.numerator[i] = xp_evidence[at + 4u + i]; value.denominator[i] = xp_evidence[at + 4u + XP_R + i];
  }
  return xr_normalize(value);
}
fn xp_scratch_store(ev: u32, field: u32, value: ExactRational) {
  let at = ev + 8u + 32u + field * XP_CS;
  xp_evidence[at] = value.negative; xp_evidence[at + 1u] = value.error;
  xp_evidence[at + 2u] = bitcast<u32>(value.exponent); xp_evidence[at + 3u] = value.reserved;
  for (var i = 0u; i < XP_R; i++) {
    xp_evidence[at + 4u + i] = value.numerator[i]; xp_evidence[at + 4u + XP_R + i] = value.denominator[i];
  }
}
@compute @workgroup_size(1)
fn validate_exact_receiver_physical_source(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x; if (position >= XP_E) { return; }
  if (!xp_bounds()) { xp_flag(${FLAGS.CONSERVATION_MOMENT}u); return; }
  let row = xp_map[position]; if (row == XP_INVALID) { return; }
  if (row >= XP_P) { xp_flag(${FLAGS.CONSERVATION_MOMENT}u); return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  var error = xp_caloric[at + 1u] | xp_current[old + 1u] | xp_merged[merged + 1u] | xp_capture[cap + 1u];
  if (xp_evidence[ev] != XP_MAGIC || xp_evidence[ev + 1u] != 1u || xp_evidence[ev + 2u] != 1u
      || xp_evidence[ev + 3u] != 0u || xp_evidence[ev + 4u] != row || xp_evidence[ev + 5u] != XP_INVALID
      || xp_evidence[ev + 6u] != 0u || xp_evidence[ev + 7u] != 0u) { error |= 8192u; }
  if (xp_caloric[at] != 1u || xp_caloric[at + 2u] != row || xp_caloric[at + 22u] != 0u
      || (xp_caloric[at + 23u] & ~32u) != 0u || xp_current[old] != 1u || xp_merged[merged] != 1u
      || xp_current[old + 6u] != row || xp_current[old + 5u] == 3u || xp_current[old + 5u] > 4u
      || xp_merged[merged + 5u] != 4u || xp_merged[merged + 6u] != row
      || xp_merged[merged + 7u] != XP_INVALID || xp_merged[merged + 8u] != XP_INVALID
      || xp_current[old + 9u] != XP_N || xp_merged[merged + 9u] != XP_N
      || xp_current[old + 10u] != XP_QR || xp_merged[merged + 10u] != XP_QR
      || xp_current[old + 11u] != 1u || xp_merged[merged + 11u] != 1u
      || xp_capture[cap] != 1u || xp_capture[cap + 2u] != row || xp_capture[cap + 3u] == 0u
      || xp_capture[cap + 8u] > position || xp_capture[cap + 9u] != position
      || xp_capture[cap + 3u] != position - xp_capture[cap + 8u] + 1u
      || xp_capture[cap + 7u] >= XP_E || xp_capture[cap + 10u] != XP_N || xp_capture[cap + 11u] != XP_QR) { error |= 8192u; }
  for (var i = 2u; i < 5u; i++) {
    if (xp_current[old + i] != xp_merged[merged + i] || xp_caloric[at + i + 1u] != xp_merged[merged + i]
        || xp_capture[cap + i + 2u] != xp_merged[merged + i]) { error |= 8192u; }
  }
  if (xp_current[old + 5u] == 4u && (xp_current[old + 7u] != XP_INVALID || xp_current[old + 8u] != XP_INVALID)) { error |= 8192u; }
  for (var i = 12u; i < 16u; i++) { if (xp_current[old + i] != 0u || xp_merged[merged + i] != 0u || xp_capture[cap + i] != 0u) { error |= 8192u; } }
  for (var i = 24u; i < 32u; i++) { if (xp_caloric[at + i] != 0u) { error |= 8192u; } }
  let descriptor = xp_caloric[at + 6u]; let material = xp_merged[merged + 2u]; let phase = xp_merged[merged + 3u];
  if (descriptor == 0u || descriptor >= params.graph_record_count || params.graph_record_count - descriptor <= 2u
      || phase < 1u || phase > 3u || u32(f32(material)) != material) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  let state0 = xp_vec(physical); let state1 = xp_vec(physical + 4u);
  let thermo0 = xp_vec(physical + 8u); let thermo1 = xp_vec(physical + 12u); let thermo2 = xp_vec(physical + 16u);
  let m0 = xp_vec(physical + 20u); let m1 = xp_vec(physical + 24u); let m2 = xp_vec(physical + 28u);
  let m3 = xp_vec(physical + 32u); let m4 = xp_vec(physical + 36u); let m5 = xp_vec(physical + 40u);
  let m6 = xp_vec(physical + 44u); let m7 = xp_vec(physical + 48u);
  let pure = vec4<f32>(select(0.0, 1.0, phase == 1u), select(0.0, 1.0, phase == 2u), select(0.0, 1.0, phase == 3u), 0.0);
  let temperature = bitcast<f32>(xp_caloric[at + 10u]); let internal = bitcast<f32>(xp_caloric[at + 11u]);
  let density = bitcast<f32>(xp_caloric[at + 12u]);
  let source_caloric = energy_phase_value(descriptor, f32(phase), state1.w, false);
  let forward = energy_phase_value(descriptor, f32(phase), temperature, true);
  let inverse = energy_phase_value(descriptor, f32(phase), internal, false);
  if (!finite_vec4(state0) || !finite_vec4(state1) || !finite_vec4(thermo0) || !finite_vec4(thermo1) || !finite_vec4(thermo2)
      || !(state0.w > 0.0) || thermo0.x != f32(material) || thermo0.y != f32(phase) || any(thermo1 != pure) || thermo2.z != 1.0
      || xp_graph[descriptor].x != f32(material) || bitcast<u32>(xp_graph[descriptor].z) != xp_merged[merged + 4u]
      || source_caloric.z != 1.0 || !(source_caloric.x > 0.0) || source_caloric.y != thermo0.w
      || abs(thermo0.z - source_caloric.x) > 1.0e-4 * source_caloric.x
      || forward.z != 1.0 || inverse.z != 1.0 || forward.w != f32(phase) || inverse.w != f32(phase)
      || !(temperature > 0.0) || !finite_scalar(temperature) || !finite_scalar(internal) || !(density > 0.0) || !finite_scalar(density)
      || bitcast<u32>(forward.x) != xp_caloric[at + 11u] || bitcast<u32>(forward.y) != xp_caloric[at + 12u]
      || inverse.y != density || !(inverse.x > 0.0) || abs(temperature - inverse.x) > 1.0e-4 * inverse.x) {
    xp_fail(row, position, 8192u, ${FLAGS.CONSERVATION_MOMENT}u); return;
  }
  // Initial supported mechanics domain. No implicit reference-density reset,
  // elastic/affine energy omission, or unaccounted thermal expansion work.
  if (!energy_relaxed_mechanics(m0, m1, m2, m3, m4) || !mechanics_refresh_determinant_matches(m0, m1, m2, m4.z)
      || !mechanics_refresh_finite_vec4(m5) || !mechanics_refresh_finite_vec4(m6) || !mechanics_refresh_finite_vec4(m7)
      || m5.y != 1.0 || m6.w != 1.0 || xp_caloric[at + 12u] != xp_physical[physical + 11u]) {
    xp_fail(row, position, 8192u, ${FLAGS.VOLUME_AUTHORITY}u); return;
  }
  xp_evidence[ev + 5u] = position; xp_evidence[ev + 2u] = 16u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_volume(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 16u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  let old_mass = xp_mass(old, false); let mass = xp_mass(merged, true);
  let delta_mass = xr_subtract(mass, old_mass);
  var error = old_mass.error | mass.error | delta_mass.error;
  if (!xp_positive(old_mass) || !xp_positive(mass) || !xp_positive(delta_mass)) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_scratch_store(ev, 0u, delta_mass); xp_evidence[ev + 2u] = 159u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_old_volume_identity(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 159u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let old = (params.current_row_offset + row) * XP_Q;
  let old_rest = xp_quantity_raw(old + XP_QOFF + 4u * XP_QS, false);
  let old_volume = xp_quantity_raw(old + XP_QOFF + 5u * XP_QS, false);
  let error = xp_equal_rationals(old_rest, old_volume);
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_evidence[ev + 2u] = 160u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_rest_delta(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 160u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let old_rest = xp_quantity(old + XP_QOFF + 4u * XP_QS, false);
  let rest = xp_quantity(merged + XP_QOFF + 4u * XP_QS, true);
  let delta_rest = xr_subtract(rest, old_rest);
  var error = old_rest.error | rest.error | delta_rest.error;
  if (!xp_positive(rest) || !xp_positive(delta_rest)) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_scratch_store(ev, 1u, delta_rest); xp_evidence[ev + 2u] = 161u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_volume_delta(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 161u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE;
  let merged = row * XP_Q;
  let rest = xp_quantity_raw(merged + XP_QOFF + 4u * XP_QS, true);
  let volume = xp_quantity_raw(merged + XP_QOFF + 5u * XP_QS, true);
  // State 161 proves old_rest == old_volume and stores the checked positive
  // difference rest - old_rest. The source buffers are read-only throughout
  // these ordered passes. Thus rest == volume also proves
  // delta_rest == volume - old_volume, without a second wide subtraction.
  var error = xp_equal_rationals(rest, volume);
  if (!xp_positive(volume)) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_evidence[ev + 2u] = 162u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_volume_closure(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 162u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let phase_mass = xp_quantity(merged + XP_QOFF + 6u * XP_QS, true);
  let old_phase_mass = xp_quantity(old + XP_QOFF + 6u * XP_QS, false);
  let delta_mass = xp_scratch_load(ev, 0u); let delta_rest = xp_scratch_load(ev, 1u);
  let expected_delta_rest = xr_divide(delta_mass, xr_from_f32_bits(xp_caloric[at + 12u]));
  var error = phase_mass.error | old_phase_mass.error | expected_delta_rest.error
    | xp_equal(delta_rest, expected_delta_rest);
  if (!xp_positive(phase_mass)) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_evidence[ev + 2u] = 17u;
}

@compute @workgroup_size(1)
fn validate_exact_receiver_volume_views(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 17u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  let old_mass = xp_mass(old, false);
  let old_rest = xp_quantity(old + XP_QOFF + 4u * XP_QS, false);
  let old_phase_mass = xp_quantity(old + XP_QOFF + 6u * XP_QS, false);
  let rest = xp_quantity(merged + XP_QOFF + 4u * XP_QS, true);
  let volume = xp_quantity(merged + XP_QOFF + 5u * XP_QS, true);
  let phase_mass = xp_quantity(merged + XP_QOFF + 6u * XP_QS, true);
  let material = xp_merged[merged + 2u]; let phase = xp_merged[merged + 3u];
  let temperature = bitcast<f32>(xp_caloric[at + 10u]);
  let m4 = xp_vec(physical + 36u); let m5 = xp_vec(physical + 40u); let m6 = xp_vec(physical + 44u);
  var volume_error = 0u;
  volume_error |= xp_project_matches(old_mass, xp_physical[physical + 3u], true)
    | xp_project_matches(old_rest, xp_physical[physical + 39u], true) | xp_project_matches(old_phase_mass, xp_physical[physical + 51u], true)
    | xp_project_matches(rest, xp_caloric[at + 17u], true) | xp_project_matches(volume, xp_caloric[at + 18u], true)
    | xp_project_matches(phase_mass, xp_caloric[at + 19u], true)
    | xp_project_matches(xr_divide(volume, rest), xp_caloric[at + 20u], true);
  if (xp_caloric[at + 20u] != 0x3f800000u) { volume_error |= 8192u; }
  let phase_mechanics = find_phase_mechanics(f32(material), f32(phase), temperature);
  let phase_finite = mechanics_refresh_finite(phase_mechanics.rest_density) && mechanics_refresh_finite(phase_mechanics.bulk)
    && mechanics_refresh_finite(phase_mechanics.shear) && mechanics_refresh_finite(phase_mechanics.lambda)
    && mechanics_refresh_finite(phase_mechanics.sound_speed) && mechanics_refresh_finite(phase_mechanics.eos_model)
    && mechanics_refresh_finite(phase_mechanics.solid) && mechanics_refresh_finite(phase_mechanics.status)
    && mechanics_refresh_finite(phase_mechanics.dynamic_viscosity) && mechanics_refresh_finite(phase_mechanics.surface_tension);
  if (!phase_finite || phase_mechanics.status != 1.0 || phase_mechanics.sound_speed < 0.0 || !(phase_mechanics.rest_density > 0.0)
      || mechanics_refresh_should_reset(m4, m5, m6, phase_mechanics, bitcast<f32>(xp_caloric[at + 17u]))) { volume_error |= 8192u; }
  if (volume_error != 0u) { xp_fail(row, position, volume_error, ${FLAGS.VOLUME_AUTHORITY}u); return; }
  xp_evidence[ev + 2u] = 18u;
}
fn xp_check_momentum(position: u32, axis: u32) {
  let row = xp_stage_row(position, 18u + axis); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C; let merged = row * XP_Q;
  let mass = xp_mass(merged, true); var error = 0u;
  var checked_projected_ke = xr_zero(); var checked_p2 = xr_zero();
  if (axis == 0u) {
    error = xp_equal(mass, xp_caloric_value(at + 32u)) | xp_project_matches(mass, xp_caloric[at + 13u], true);
  } else {
    checked_p2 = xp_scratch_load(ev, 2u); checked_projected_ke = xp_scratch_load(ev, 3u);
  }
  // Retained P/E residuals are coordinates, never another spendable sum.
  let momentum = xp_quantity(merged + XP_QOFF + axis * XP_QS, true);
  let velocity = xr_divide(momentum, mass);
  let stored_velocity = xr_from_f32_bits(xp_caloric[at + 14u + axis]);
  let residual = xr_subtract(momentum, xr_multiply(mass, stored_velocity));
  checked_projected_ke = xr_add(checked_projected_ke, xr_scale_pow2(xr_multiply(mass, xr_multiply(stored_velocity, stored_velocity)), -1));
  checked_p2 = xr_add(checked_p2, xr_multiply(momentum, momentum));
  error |= xp_project_matches(velocity, xp_caloric[at + 14u + axis], false)
    | xp_equal(residual, xp_caloric_value(at + 32u + (4u + axis) * XP_CS));
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  xp_scratch_store(ev, 2u, checked_p2); xp_scratch_store(ev, 3u, checked_projected_ke);
  xp_evidence[ev + 2u] = 19u + axis;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_momentum_x(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  xp_check_momentum(id.x + id.y * groups.x, 0u);
}
@compute @workgroup_size(1)
fn validate_exact_receiver_momentum_y(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  xp_check_momentum(id.x + id.y * groups.x, 1u);
}
@compute @workgroup_size(1)
fn validate_exact_receiver_momentum_z(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  xp_check_momentum(id.x + id.y * groups.x, 2u);
}
@compute @workgroup_size(1)
fn validate_exact_receiver_kinetic(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 21u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  let mass = xp_mass(merged, true); var error = 0u;
  let checked_p2 = xp_scratch_load(ev, 2u); let checked_projected_ke = xp_scratch_load(ev, 3u);
  let total_energy = xp_quantity(merged + XP_QOFF + 3u * XP_QS, true);
  let projected_ke = xp_caloric_value(at + 32u + 3u * XP_CS);
  let checked_ke = xr_scale_pow2(xr_divide(checked_p2, mass), -1);
  let checked_internal = xr_subtract(total_energy, checked_ke);
  error |= xp_equal(projected_ke, checked_projected_ke)
    | xp_equal(checked_ke, xp_caloric_value(at + 32u + 2u * XP_CS))
    | xp_equal(checked_internal, xp_caloric_value(at + 32u + XP_CS));
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  xp_scratch_store(ev, 1u, checked_internal);
  xp_evidence[ev + 2u] = 22u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_energy_view(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 22u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  let mass = xp_mass(merged, true);
  let total_energy = xp_quantity(merged + XP_QOFF + 3u * XP_QS, true);
  let projected_ke = xp_caloric_value(at + 32u + 3u * XP_CS);
  let checked_internal = xp_scratch_load(ev, 1u);
  let projected_internal = xr_multiply(mass, xr_from_f32_bits(xp_caloric[at + 11u]));
  var error = xp_equal(xr_subtract(checked_internal, projected_internal), xp_caloric_value(at + 32u + 7u * XP_CS));
  let view_residual = xr_subtract(total_energy, xr_add(projected_internal, projected_ke));
  error |= xp_equal(view_residual, xp_caloric_value(at + 32u + 8u * XP_CS));
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  xp_evidence[ev + 2u] = 23u;
}
@compute @workgroup_size(1)
fn validate_exact_receiver_entities(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 23u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  let mass = xp_mass(merged, true); var error = 0u;
  var avogadro = xr_zero();
  avogadro.numerator[0u] = 1556480000u;
  avogadro.numerator[1u] = 388587284u;
  avogadro.numerator[2u] = 32646u;
  let entities = xr_multiply(xr_divide(mass, xr_from_f32_bits(xp_merged[merged + 4u])), xr_normalize(avogadro));
  error |= xp_project_matches(entities, xp_caloric[at + 21u], true);
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  xp_evidence[ev + 2u] = 24u;
}
@compute @workgroup_size(1)
fn prepare_exact_receiver_physical_segment_tails(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  let row = xp_stage_row(position, 24u); if (row == XP_INVALID) { return; }
  let ev = row * XP_EVIDENCE; let at = position * XP_C;
  let old = (params.current_row_offset + row) * XP_Q; let merged = row * XP_Q;
  let cap = position * XP_CAPTURE; let physical = row * 52u;
  var error = 0u;
  let material = xp_merged[merged + 2u]; let phase = xp_merged[merged + 3u];
  let temperature = bitcast<f32>(xp_caloric[at + 10u]);
  let phase_mechanics = find_phase_mechanics(f32(material), f32(phase), temperature);
  let mass_view = bitcast<f32>(xp_caloric[at + 13u]);
  let velocity_view = bitcast<vec3<f32>>(vec3<u32>(xp_caloric[at + 14u], xp_caloric[at + 15u], xp_caloric[at + 16u]));
  let rest_view = bitcast<f32>(xp_caloric[at + 17u]); let volume_view = bitcast<f32>(xp_caloric[at + 18u]);
  let phase_mass_view = bitcast<f32>(xp_caloric[at + 19u]); let entities_view = bitcast<f32>(xp_caloric[at + 21u]);
  let position_at = XP_E + row * 4u;
  var position_bits = vec3<u32>(xp_map[position_at], xp_map[position_at + 1u], xp_map[position_at + 2u]);
  var position_view = bitcast<vec3<f32>>(position_bits);
  let aggregate3 = reduced_values[position * 6u + 3u]; let selected4 = reduced_values[position * 6u + 4u];
  let selected5 = reduced_values[position * 6u + 5u];
  if (xp_map[position_at + 3u] != 0u || !finite_scalar(mass_view)
      || !finite_vec3(velocity_view) || !finite_vec3(position_view)
      || !finite_scalar(rest_view) || !finite_scalar(volume_view)
      || !finite_scalar(phase_mass_view) || !finite_scalar(entities_view)
      || !finite_scalar(aggregate3.z) || !finite_vec4(selected4) || !finite_vec4(selected5)) { error |= 8192u; }
  if (error != 0u) { xp_fail(row, position, error, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  if (phase_is_gas(f32(phase)) && selected5.w > 0.0) {
    let routed = route_merged_gas(selected4.xyz, selected5.xyz, selected4.w, volume_view, position_view);
    if (routed.w > 0.0) { position_view = routed.xyz; position_bits = bitcast<vec3<u32>>(routed.xyz); }
  }
  if (!finite_vec3(position_view)) { xp_fail(row, position, 8192u, ${FLAGS.CONSERVATION_MOMENT}u); return; }
  // Owned packed candidate only. Preserve every unchanged original raw word,
  // including pressure lineage, signed zero and subnormal bit patterns.
  let dest = row * 56u;
  for (var i = 0u; i < 52u; i++) { xp_candidate[dest + i] = xp_physical[physical + i]; }
  xp_candidate[dest] = position_bits.x; xp_candidate[dest + 1u] = position_bits.y; xp_candidate[dest + 2u] = position_bits.z;
  xp_candidate[dest + 3u] = xp_caloric[at + 13u];
  for (var axis = 0u; axis < 3u; axis++) { xp_candidate[dest + 4u + axis] = xp_caloric[at + 14u + axis]; }
  xp_candidate[dest + 7u] = xp_caloric[at + 11u]; xp_candidate[dest + 10u] = xp_caloric[at + 10u];
  xp_candidate[dest + 11u] = xp_caloric[at + 12u]; xp_candidate[dest + 17u] = xp_caloric[at + 21u];
  xp_candidate[dest + 38u] = xp_caloric[at + 20u]; xp_candidate[dest + 39u] = xp_caloric[at + 17u];
  xp_candidate[dest + 40u] = bitcast<u32>(phase_mechanics.solid); xp_candidate[dest + 41u] = bitcast<u32>(phase_mechanics.status);
  xp_candidate[dest + 42u] = bitcast<u32>(phase_mechanics.bulk); xp_candidate[dest + 43u] = bitcast<u32>(phase_mechanics.shear);
  xp_candidate[dest + 44u] = bitcast<u32>(phase_mechanics.lambda); xp_candidate[dest + 45u] = bitcast<u32>(phase_mechanics.sound_speed);
  xp_candidate[dest + 46u] = bitcast<u32>(phase_mechanics.eos_model); xp_candidate[dest + 47u] = bitcast<u32>(phase_mechanics.status);
  // dest48 = original M28 resolvedAbsolutePressurePa, copied above.
  xp_candidate[dest + 49u] = bitcast<u32>(phase_mechanics.dynamic_viscosity);
  xp_candidate[dest + 50u] = bitcast<u32>(phase_mechanics.surface_tension); xp_candidate[dest + 51u] = xp_caloric[at + 19u];
  xp_candidate[dest + 52u] = xp_capture[cap + 7u]; xp_candidate[dest + 53u] = xp_capture[cap + 3u];
  xp_candidate[dest + 54u] = bitcast<u32>(aggregate3.z); xp_candidate[dest + 55u] = 0u;
  for (var i = 0u; i < XP_C; i++) { xp_evidence[ev + 8u + i] = xp_caloric[at + i]; }
  xp_evidence[ev + 5u] = position; xp_evidence[ev + 6u] = 4u;
  xp_evidence[ev + 2u] = 4u; // Prepared, never counts as applied.

}

`;
}

function createRawApplyWgsl(l, quantity, caloric) {
  return /* wgsl */ `
const XA_P: u32 = ${l.particleCount}u;
const XA_E: u32 = ${l.eventCapacity}u;
const XA_Q: u32 = ${quantity.recordWords}u;
const XA_EV: u32 = ${l.evidenceRecordWords}u;
@group(0) @binding(0) var<storage, read> xa_candidate: array<u32>;
@group(0) @binding(1) var<storage, read> xa_merged: array<u32>;
@group(0) @binding(2) var<storage, read_write> xa_evidence: array<u32>;
@group(0) @binding(3) var<storage, read_write> xa_state: array<u32>;
@group(0) @binding(4) var<storage, read_write> xa_thermo: array<u32>;
@group(0) @binding(5) var<storage, read_write> xa_mechanics: array<u32>;
@group(0) @binding(6) var<storage, read_write> xa_current: array<u32>;
@group(0) @binding(7) var<storage, read_write> xa_summary: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> xa_receipt: array<atomic<u32>>;
fn xa_flag() {
  if (arrayLength(&xa_receipt) > ${RECEIPT.overflowFlags}u) { atomicOr(&xa_receipt[${RECEIPT.overflowFlags}u], ${FLAGS.CONSERVATION_MOMENT}u); }
}
fn xa_fail(at: u32) {
  xa_flag(); xa_evidence[at + 2u] = 3u; xa_evidence[at + 3u] |= 8192u;
}
@compute @workgroup_size(1)
fn apply_exact_receiver_physical_segment_tails(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let row = id.x + id.y * groups.x; if (row >= XA_P) { return; }
  if (arrayLength(&xa_candidate) < ${l.candidateWordLength}u || arrayLength(&xa_merged) < ${l.outputQuantityWordLength}u
      || arrayLength(&xa_evidence) < ${l.evidenceWordLength}u || arrayLength(&xa_state) < XA_P * 8u
      || arrayLength(&xa_thermo) < XA_P * 12u || arrayLength(&xa_mechanics) < XA_P * 32u
      || arrayLength(&xa_current) < ${l.outputQuantityWordLength}u || arrayLength(&xa_summary) < XA_E * 9u
      || arrayLength(&xa_receipt) < ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) { xa_flag(); return; }
  if (row == 0u) {
    let previous_apply_count = atomicAdd(&xa_receipt[${RECEIPT.destinationApplyPassCount}u], 1u);
    // The original later direct apply stores the final count 2. Keep a sticky
    // failure for any repeated or out-of-order capture apply before that store.
    if (previous_apply_count != 0u) { xa_flag(); }
    atomicStore(&xa_receipt[${RECEIPT.destinationIntentVisitedCount}u], XA_E * 2u);
  }
  let ev = row * XA_EV; let source = row * 56u; let q = row * XA_Q;
  if (xa_evidence[ev] != ${SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC}u || xa_evidence[ev + 1u] != 1u
      || xa_evidence[ev + 3u] != 0u || xa_evidence[ev + 4u] != row || xa_evidence[ev + 7u] != 0u) { xa_fail(ev); return; }
  if (xa_evidence[ev + 2u] == 1u) {
    if (xa_evidence[ev + 5u] != 0xffffffffu || xa_evidence[ev + 6u] != 0u) { xa_fail(ev); }
    return; // Untouched; deny-only terminal separately knows affected tails.
  }
  if (xa_evidence[ev + 2u] != 4u || xa_evidence[ev + 5u] >= XA_E || xa_evidence[ev + 6u] != 4u
      || xa_evidence[ev + 8u] != 1u || xa_evidence[ev + 9u] != 0u || xa_evidence[ev + 10u] != row
      || xa_merged[q] != 1u || xa_merged[q + 1u] != 0u || xa_merged[q + 5u] != 4u || xa_merged[q + 6u] != row
      || xa_merged[q + 7u] != 0xffffffffu || xa_merged[q + 8u] != 0xffffffffu
      || xa_candidate[source + 52u] >= XA_E || xa_candidate[source + 53u] == 0u || xa_candidate[source + 55u] != 0u) { xa_fail(ev); return; }
  // Only raw copies touch S/T/M. Read-only inputs are original-owner admitted;
  // no host flag or ready value registers physical authority.
  for (var i = 0u; i < 8u; i++) { xa_state[row * 8u + i] = xa_candidate[source + i]; }
  for (var i = 0u; i < 12u; i++) { xa_thermo[row * 12u + i] = xa_candidate[source + 8u + i]; }
  for (var i = 0u; i < 32u; i++) { xa_mechanics[row * 32u + i] = xa_candidate[source + 20u + i]; }
  for (var i = 0u; i < XA_Q; i++) { xa_current[q + i] = xa_merged[q + i]; }
  let summary_base = xa_candidate[source + 52u] * 9u;
  let maxima = xa_summary[summary_base + 6u];
  xa_summary[summary_base + 6u] = vec4<f32>(maxima.xy, max(maxima.z, bitcast<f32>(xa_candidate[source + 3u])), maxima.w);
  let distances = xa_summary[summary_base + 7u];
  xa_summary[summary_base + 7u] = vec4<f32>(max(distances.x, bitcast<f32>(xa_candidate[source + 54u])), distances.yzw);
  atomicAdd(&xa_receipt[${RECEIPT.destinationMutationCount}u], 1u);
  atomicMax(&xa_receipt[${RECEIPT.maxDestinationSegmentSize}u], xa_candidate[source + 53u]);
  xa_evidence[ev + 2u] = 2u;
}
`;
}
