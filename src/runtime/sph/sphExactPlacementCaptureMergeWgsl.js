import { sphExactPlacementCaptureLayout } from './sphExactPlacementCaptureWgsl.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as RECEIPT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

/** Scratch only: a current quantity row per physical receiver plus the
 * original sorted-tail map [E] and projected COM position/error words [P*4].
 * The caloric preparation consumes the first E map words directly. Neither
 * ready rows nor this map confer physical placement or publication authority.
 */
export function sphExactPlacementCaptureMergeLayout(format, quantityLayout) {
  const capture = sphExactPlacementCaptureLayout(format, quantityLayout);
  const p = capture.particleCount, e = capture.eventCapacity;
  const mergedWords = p * capture.quantityRecordWords, mapWords = e + p * 4;
  if (![mergedWords, mapWords].every(x => Number.isSafeInteger(x) && x > 0 && x <= 0x3fffffff)) {
    throw new RangeError('Exact capture merge exceeds checked addressing');
  }
  return Object.freeze({ schema: 'peercompute.ulg.exact-capture-merge-scratch.v1', capture,
    particleCount: p, eventCapacity: e, recordWords: capture.quantityRecordWords,
    mergedWordLength: mergedWords, mergedByteLength: mergedWords * 4,
    receiverMapOffsetWords: 0, receiverMapCount: e, positionOffsetWords: e,
    positionStrideWords: 4, mapWordLength: mapWords, mapByteLength: mapWords * 4,
    mergedKind: 4, storageBindingCount: 8, workgroupSize: 1 });
}

export function createSphExactPlacementCaptureMergeWgsl(format, quantityLayout) {
  const l = sphExactPlacementCaptureMergeLayout(format, quantityLayout), c = l.capture;
  return createSphExactRationalQuantityWgsl({ wordCount: c.scalar.wordCount }) + /* wgsl */ `
const XM_P: u32 = ${l.particleCount}u;
const XM_E: u32 = ${l.eventCapacity}u;
const XM_N: u32 = ${c.massWordCount}u;
const XM_R: u32 = ${c.scalar.wordCount}u;
const XM_Q: u32 = ${l.recordWords}u;
const XM_C: u32 = ${c.recordWords}u;
const XM_SCALAR: u32 = ${c.scalar.recordWords}u;
const XM_OFFSET: u32 = ${c.scalarOffsetWords}u;
const XM_INVALID: u32 = 0xffffffffu;
@group(0) @binding(0) var<storage, read> xm_keys: array<u32>;
@group(0) @binding(1) var<storage, read> xm_sorted: array<u32>;
@group(0) @binding(2) var<storage, read> xm_capture: array<u32>;
@group(0) @binding(3) var<storage, read> xm_current: array<u32>;
@group(0) @binding(4) var<storage, read> xm_state: array<u32>;
@group(0) @binding(5) var<storage, read_write> xm_merged: array<u32>;
@group(0) @binding(6) var<storage, read_write> xm_map: array<u32>;
@group(0) @binding(7) var<storage, read_write> xm_receipt: array<atomic<u32>>;
fn xm_bounds() -> bool {
  return arrayLength(&xm_keys) >= XM_E && arrayLength(&xm_sorted) >= XM_E
    && arrayLength(&xm_capture) >= ${c.wordLength}u && arrayLength(&xm_current) >= ${c.quantityWordLength}u
    && arrayLength(&xm_state) >= XM_P * 8u && arrayLength(&xm_merged) >= ${l.mergedWordLength}u
    && arrayLength(&xm_map) >= ${l.mapWordLength}u && arrayLength(&xm_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u;
}
fn xm_flag() {
  if (arrayLength(&xm_receipt) > ${RECEIPT.overflowFlags}u) {
    atomicOr(&xm_receipt[${RECEIPT.overflowFlags}u], ${FLAGS.CONSERVATION_MOMENT}u);
  }
}
fn xm_fail(receiver: u32, error: u32) {
  xm_flag(); xm_merged[receiver * XM_Q] = 0u; xm_merged[receiver * XM_Q + 1u] = error;
  xm_map[XM_E + receiver * 4u + 3u] = error;
}
fn xm_read_current(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = xm_current[at]; value.error = xm_current[at + 1u];
  value.exponent = bitcast<i32>(xm_current[at + 2u]); value.reserved = xm_current[at + 3u];
  for (var i = 0u; i < XM_R; i++) { value.numerator[i] = xm_current[at + 4u + i]; value.denominator[i] = xm_current[at + 4u + XM_R + i]; }
  return xr_normalize(value);
}
fn xm_read_capture(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = xm_capture[at]; value.error = xm_capture[at + 1u];
  value.exponent = bitcast<i32>(xm_capture[at + 2u]); value.reserved = xm_capture[at + 3u];
  for (var i = 0u; i < XM_R; i++) { value.numerator[i] = xm_capture[at + 4u + i]; value.denominator[i] = xm_capture[at + 4u + XM_R + i]; }
  return xr_normalize(value);
}
fn xm_store(at: u32, value: ExactRational) {
  xm_merged[at] = value.negative; xm_merged[at + 1u] = value.error;
  xm_merged[at + 2u] = bitcast<u32>(value.exponent); xm_merged[at + 3u] = value.reserved;
  for (var i = 0u; i < XM_R; i++) { xm_merged[at + 4u + i] = value.numerator[i]; xm_merged[at + 4u + XM_R + i] = value.denominator[i]; }
}
@compute @workgroup_size(1)
fn initialize_exact_capture_merge(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let row = id.x + id.y * groups.x;
  if (row >= max(XM_P, XM_E)) { return; }
  if (!xm_bounds()) { xm_flag(); return; }
  if (row < XM_E) { xm_map[row] = XM_INVALID; }
  if (row < XM_P) {
    let source = (${c.quantityCurrentRowOffset}u + row) * XM_Q;
    for (var i = 0u; i < XM_Q; i++) { xm_merged[row * XM_Q + i] = xm_current[source + i]; }
    for (var axis = 0u; axis < 3u; axis++) { xm_map[XM_E + row * 4u + axis] = xm_state[row * 8u + axis]; }
    xm_map[XM_E + row * 4u + 3u] = 0u;
  }
}
// The unique writer is exactly the tail in the EXISTING stable capture sort.
// All current quantities come from its authenticated current row, not rounded
// S/T/M or the birth packet. Rounded S contributes only the placement position.
@compute @workgroup_size(1)
fn merge_exact_capture_segment_tails(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  if (position >= XM_E) { return; }
  if (!xm_bounds()) { xm_flag(); return; }
  let event = xm_sorted[position];
  if (event >= XM_E) { xm_flag(); return; }
  let receiver = xm_keys[event]; if (receiver == XM_INVALID) { return; }
  if (receiver >= XM_P) { xm_flag(); return; }
  if (position + 1u < XM_E) {
    let next_event = xm_sorted[position + 1u];
    if (next_event >= XM_E) { xm_flag(); return; }
    if (xm_keys[next_event] == receiver) { return; }
  }
  let tail = position * XM_C; let current = (${c.quantityCurrentRowOffset}u + receiver) * XM_Q;
  let dest = receiver * XM_Q;
  var error = xm_capture[tail + 1u] | xm_current[current + 1u];
  if (xm_capture[tail] != 1u || xm_capture[tail + 2u] != receiver || xm_capture[tail + 3u] == 0u
    || xm_capture[tail + 8u] > position || xm_capture[tail + 9u] != position
    || xm_capture[tail + 3u] != position - xm_capture[tail + 8u] + 1u
    || xm_capture[tail + 10u] != XM_N || xm_capture[tail + 11u] != XM_R
    || xm_current[current] != 1u || xm_current[current + 6u] != receiver
    || xm_current[current + 5u] == 3u || xm_current[current + 5u] > 4u
    || xm_current[current + 9u] != XM_N || xm_current[current + 10u] != XM_R
    || xm_current[current + 11u] != 1u) { error |= 8192u; }
  if (xm_current[current + 5u] == 4u && (xm_current[current + 7u] != XM_INVALID || xm_current[current + 8u] != XM_INVALID)) { error |= 8192u; }
  for (var i = 2u; i < 5u; i++) { if (xm_capture[tail + i + 2u] != xm_current[current + i]) { error |= 8192u; } }
  for (var i = 12u; i < 16u; i++) { if (xm_capture[tail + i] != 0u || xm_current[current + i] != 0u) { error |= 8192u; } }
  // A locally valid suffix is not the complete receiver segment. The genuine
  // original sort is contiguous by receiver, so its preceding key proves the
  // retained span begins at this receiver's FIRST sorted event.
  if (error == 0u && xm_capture[tail + 8u] > 0u) {
    let preceding_event = xm_sorted[xm_capture[tail + 8u] - 1u];
    if (preceding_event >= XM_E) { error |= 8192u; }
    else if (xm_keys[preceding_event] == receiver) { error |= 8192u; }
  }
  if (error != 0u) { xm_fail(receiver, error); return; }
  var current_mass = xr_zero(); var merged_mass = xr_zero(); var carry = 0u;
  var current_positive = false; var incoming_positive = false;
  for (var i = 0u; i < XM_N; i++) {
    let a = xm_current[current + 16u + i]; let b = xm_capture[tail + 16u + i];
    current_positive = current_positive || a != 0u; incoming_positive = incoming_positive || b != 0u;
    current_mass.numerator[i] = a; let first = a + b; let sum = first + carry;
    carry = select(0u, 1u, first < a || sum < first); merged_mass.numerator[i] = sum;
    xm_merged[dest + 16u + i] = sum;
  }
  if (!current_positive || !incoming_positive) { error |= 8192u; }
  if (carry != 0u) { error |= 1u; }
  current_mass = xr_scale_pow2(current_mass, ${format.quantumExponent});
  merged_mass = xr_scale_pow2(merged_mass, ${format.quantumExponent});
  error |= current_mass.error | merged_mass.error;
  if (error != 0u) { xm_fail(receiver, error); return; }
  for (var field = 0u; field < 7u; field++) {
    let offset = XM_OFFSET + field * XM_SCALAR;
    let value = xr_add(xm_read_current(current + offset), xm_read_capture(tail + offset));
    error |= value.error; xm_store(dest + offset, value);
  }
  for (var axis = 0u; axis < 3u; axis++) {
    let old_position = xr_from_f32_bits(xm_state[receiver * 8u + axis]);
    let moment = xr_add(xr_multiply(current_mass, old_position), xm_read_capture(tail + XM_OFFSET + (7u + axis) * XM_SCALAR));
    let next_position = xr_divide(moment, merged_mass); let projected = xr_project_f32_bits(next_position);
    // Same view policy as physical reaction output centroid: signed projection
    // underflow may round to zero; other numeric/projection errors reject.
    error |= moment.error | next_position.error | (projected.error & ~32u);
    xm_map[XM_E + receiver * 4u + axis] = projected.bits;
  }
  if (error != 0u) { xm_fail(receiver, error); return; }
  // Kind4 records a merged CURRENT quantity; kind3 remains empty/inactive.
  // SourceRow remains the receiver;
  // no single pair/term can describe a sum of independent incoming fragments.
  xm_merged[dest + 5u] = 4u; xm_merged[dest + 7u] = XM_INVALID; xm_merged[dest + 8u] = XM_INVALID;
  xm_merged[dest + 1u] = 0u; xm_merged[dest] = 1u;
  xm_map[position] = receiver;
}
`;
}
