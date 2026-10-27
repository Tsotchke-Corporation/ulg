import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as RECEIPT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout }
  from './sphExactRationalQuantityWgsl.js';

const checked = (n, name) => {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0x3fffffff) throw new RangeError(`Exact capture ${name} exceeds checked addressing`);
  return n;
};
export const SPH_EXACT_CAPTURE_FIELDS = Object.freeze([
  'momentumX', 'momentumY', 'momentumZ', 'totalEnergy', 'restVolume', 'currentVolume', 'phaseReferenceMass',
  'positionMomentX', 'positionMomentY', 'positionMomentZ'
]);

/** Numeric scratch only; never a particle/history owner or publication receipt.
 * The first seven fields are incoming extensive quantities. The last three are
 * temporary moments of the existing routed physical position, not new conserved
 * state. A ready row does not authorize physical apply or terminal publication.
 * Header16: ready,error,receiver,count,material,phase,molarBits,selectedEvent,
 * sortedSpanStart,sortedSpanEnd,N,R,reserved[4]. Then mass[N], ten XR records.
 */
export function sphExactPlacementCaptureLayout(format, quantityLayout) {
  validateSphExactMassFormat(format);
  const n = format.wordCount, p = checked(quantityLayout?.particleCount, 'particles');
  const capacity = checked(quantityLayout?.eventCapacity, 'events');
  const scalar = sphExactRationalQuantityLayout({ wordCount: quantityLayout?.scalar?.wordCount });
  if (quantityLayout.massWordCount !== n || quantityLayout.massOffsetWords !== 16
    || quantityLayout.scalarOffsetWords !== 16 + n || quantityLayout.scalar.recordWords !== scalar.recordWords
    || quantityLayout.recordWords !== 16 + n + 7 * scalar.recordWords
    || ![0, p].includes(quantityLayout.currentRowOffset)
    || quantityLayout.eventRowOffset !== quantityLayout.currentRowOffset + p
    || quantityLayout.rowCount !== quantityLayout.eventRowOffset + capacity
    || quantityLayout.wordLength !== quantityLayout.rowCount * quantityLayout.recordWords) {
    throw new TypeError('Original current quantity row layout or authenticated persistent current layout required');
  }
  checked(quantityLayout.wordLength, 'quantity words');
  const recordWords = checked(16 + n + 10 * scalar.recordWords, 'scratch record');
  return Object.freeze({ schema: 'peercompute.ulg.exact-capture-scratch.v1',
    particleCount: p, eventCapacity: capacity, massWordCount: n, quantumExponent: format.quantumExponent,
    headerWords: 16, massOffsetWords: 16, scalarOffsetWords: 16 + n, scalar,
    recordWords, wordLength: checked(capacity * recordWords, 'scratch words'),
    byteLength: checked(capacity * recordWords, 'scratch words') * 4,
    quantityRecordWords: quantityLayout.recordWords, quantityWordLength: quantityLayout.wordLength,
    quantityCurrentRowOffset: quantityLayout.currentRowOffset, quantityEventRowOffset: quantityLayout.eventRowOffset,
    geometryRecordWords: 24, geometryRoutedPositionOffsetWords: 20,
    fields: SPH_EXACT_CAPTURE_FIELDS, storageBindingCount: 8, workgroupSize: 1 });
}

/** Uses precisely the existing reduction-parameter blocks: [capacity,stride,6,1].
 * Exact shaders use their compiled record stride; the existing value stride6 is
 * validated to prevent accidentally binding a direct/summary reduction block.
 */
export function createSphExactPlacementCaptureWgsl(format, quantityLayout) {
  const l = sphExactPlacementCaptureLayout(format, quantityLayout), n = format.wordCount;
  return createSphExactRationalQuantityWgsl({ wordCount: l.scalar.wordCount }) + /* wgsl */ `
const XC_N: u32 = ${n}u;
const XC_R: u32 = ${l.scalar.wordCount}u;
const XC_CAPACITY: u32 = ${l.eventCapacity}u;
const XC_PARTICLES: u32 = ${l.particleCount}u;
const XC_RECORD: u32 = ${l.recordWords}u;
const XC_SCALAR: u32 = ${l.scalar.recordWords}u;
const XC_SCALAR_OFFSET: u32 = ${l.scalarOffsetWords}u;
const XC_Q_RECORD: u32 = ${l.quantityRecordWords}u;
const XC_INVALID: u32 = 0xffffffffu;
struct ExactCaptureReductionParams {
  element_count: u32, stride: u32, value_stride_vec4: u32, key_stride_words: u32
}
@group(0) @binding(0) var<storage, read> xc_keys: array<u32>;
@group(0) @binding(1) var<storage, read> xc_sorted: array<u32>;
@group(0) @binding(2) var<storage, read> xc_quantities: array<u32>;
@group(0) @binding(3) var<storage, read> xc_geometry: array<u32>;
@group(0) @binding(4) var<storage, read> xc_count: array<u32>;
@group(0) @binding(5) var<storage, read> xc_input: array<u32>;
@group(0) @binding(6) var<storage, read_write> xc_output: array<u32>;
@group(0) @binding(7) var<storage, read_write> xc_receipt: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> xc_reduce: ExactCaptureReductionParams;
fn xc_clear(at: u32) {
  for (var i = 0u; i < XC_RECORD; i++) { xc_output[at + i] = 0u; }
}
fn xc_fail(at: u32, error: u32) {
  if (arrayLength(&xc_output) >= at + XC_RECORD) { xc_clear(at); xc_output[at + 1u] = error; }
  if (arrayLength(&xc_receipt) > ${RECEIPT.overflowFlags}u) {
    atomicOr(&xc_receipt[${RECEIPT.overflowFlags}u], ${FLAGS.CONSERVATION_MOMENT}u);
  }
}
fn xc_bounds() -> bool {
  return xc_reduce.element_count == XC_CAPACITY && xc_reduce.value_stride_vec4 == 6u && xc_reduce.key_stride_words == 1u
    && arrayLength(&xc_keys) >= XC_CAPACITY && arrayLength(&xc_sorted) >= XC_CAPACITY
    && arrayLength(&xc_quantities) >= ${l.quantityWordLength}u
    && arrayLength(&xc_geometry) >= ${l.eventCapacity * 24}u && arrayLength(&xc_count) >= 2u
    && arrayLength(&xc_input) >= ${l.wordLength}u && arrayLength(&xc_output) >= ${l.wordLength}u
    && arrayLength(&xc_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u;
}
fn xc_read_quantity(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = xc_quantities[at]; value.error = xc_quantities[at + 1u];
  value.exponent = bitcast<i32>(xc_quantities[at + 2u]); value.reserved = xc_quantities[at + 3u];
  for (var i = 0u; i < XC_R; i++) { value.numerator[i] = xc_quantities[at + 4u + i]; value.denominator[i] = xc_quantities[at + 4u + XC_R + i]; }
  return xr_normalize(value);
}
fn xc_read_input(at: u32) -> ExactRational {
  var value = xr_zero(); value.negative = xc_input[at]; value.error = xc_input[at + 1u];
  value.exponent = bitcast<i32>(xc_input[at + 2u]); value.reserved = xc_input[at + 3u];
  for (var i = 0u; i < XC_R; i++) { value.numerator[i] = xc_input[at + 4u + i]; value.denominator[i] = xc_input[at + 4u + XC_R + i]; }
  return xr_normalize(value);
}
fn xc_store(at: u32, value: ExactRational) {
  xc_output[at] = value.negative; xc_output[at + 1u] = value.error;
  xc_output[at + 2u] = bitcast<u32>(value.exponent); xc_output[at + 3u] = value.reserved;
  for (var i = 0u; i < XC_R; i++) { xc_output[at + 4u + i] = value.numerator[i]; xc_output[at + 4u + XC_R + i] = value.denominator[i]; }
}
fn xc_quantity_header_error(at: u32) -> u32 {
  var error = xc_quantities[at + 1u];
  if (xc_quantities[at] != 1u || xc_quantities[at + 9u] != XC_N || xc_quantities[at + 10u] != XC_R
    || xc_quantities[at + 11u] != 1u || xc_quantities[at + 3u] < 1u || xc_quantities[at + 3u] > 3u
    || xc_quantities[at + 5u] == 3u || xc_quantities[at + 5u] > 4u
    || xc_quantities[at + 4u] == 0u || xc_quantities[at + 4u] >= 0x7f800000u) { error |= 8192u; }
  if (xc_quantities[at + 5u] == 4u && (xc_quantities[at + 7u] != XC_INVALID || xc_quantities[at + 8u] != XC_INVALID)) { error |= 8192u; }
  for (var i = 12u; i < 16u; i++) { if (xc_quantities[at + i] != 0u) { error |= 8192u; } }
  var positive = false;
  for (var i = 0u; i < XC_N; i++) { positive = positive || xc_quantities[at + 16u + i] != 0u; }
  if (!positive) { error |= 8192u; } return error;
}
fn xc_header_error(at: u32, position: u32, receiver: u32) -> u32 {
  var error = xc_input[at + 1u];
  if (xc_input[at] != 1u || xc_input[at + 2u] != receiver || xc_input[at + 3u] == 0u
    || xc_input[at + 8u] > position || xc_input[at + 9u] != position
    || xc_input[at + 3u] != position - xc_input[at + 8u] + 1u
    || xc_input[at + 10u] != XC_N || xc_input[at + 11u] != XC_R
    || xc_input[at + 7u] >= xc_count[0u]) { error |= 8192u; }
  for (var i = 12u; i < 16u; i++) { if (xc_input[at + i] != 0u) { error |= 8192u; } }
  return error;
}
// Original compact-event -> quantity mapping; no second sort or ownership mint.
@compute @workgroup_size(1)
fn initialize_exact_capture_segments(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  if (position >= XC_CAPACITY) { return; }
  let dest = position * XC_RECORD;
  if (!xc_bounds() || xc_reduce.stride != 0u) { xc_fail(dest, 8192u); return; }
  xc_clear(dest);
  if (xc_count[0u] > XC_CAPACITY || xc_count[1u] != 0u) { xc_fail(dest, xc_count[1u] | 8192u); return; }
  let event = xc_sorted[position];
  if (event >= XC_CAPACITY) { xc_fail(dest, 8192u); return; }
  let receiver = xc_keys[event]; if (receiver == XC_INVALID) { return; }
  if (event >= xc_count[0u] || receiver >= XC_PARTICLES) { xc_fail(dest, 8192u); return; }
  let source = (${l.quantityEventRowOffset}u + event) * XC_Q_RECORD;
  let current = (${l.quantityCurrentRowOffset}u + receiver) * XC_Q_RECORD;
  var error = xc_quantity_header_error(source) | xc_quantity_header_error(current);
  if (xc_quantities[source + 5u] != 2u || xc_quantities[source + 6u] != event
    || xc_quantities[source + 7u] >= XC_PARTICLES || xc_quantities[source + 8u] < 2u
    || xc_quantities[current + 6u] != receiver) { error |= 8192u; }
  for (var i = 2u; i < 5u; i++) { if (xc_quantities[source + i] != xc_quantities[current + i]) { error |= 8192u; } }
  if (error != 0u) { xc_fail(dest, error); return; }
  var mass = xr_zero();
  for (var i = 0u; i < XC_N; i++) { let word = xc_quantities[source + 16u + i]; mass.numerator[i] = word; xc_output[dest + 16u + i] = word; }
  mass = xr_scale_pow2(mass, ${format.quantumExponent}); error |= mass.error;
  for (var field = 0u; field < 10u; field++) {
    var value = xr_zero();
    if (field < 7u) { value = xc_read_quantity(source + XC_SCALAR_OFFSET + field * XC_SCALAR); }
    else { value = xr_multiply(mass, xr_from_f32_bits(xc_geometry[event * 24u + 20u + field - 7u])); }
    error |= value.error; xc_store(dest + XC_SCALAR_OFFSET + field * XC_SCALAR, value);
  }
  if (error != 0u) { xc_fail(dest, error); return; }
  xc_output[dest + 2u] = receiver; xc_output[dest + 3u] = 1u;
  for (var i = 2u; i < 5u; i++) { xc_output[dest + 2u + i] = xc_quantities[source + i]; }
  xc_output[dest + 7u] = event; xc_output[dest + 8u] = position; xc_output[dest + 9u] = position;
  xc_output[dest + 10u] = XC_N; xc_output[dest + 11u] = XC_R; xc_output[dest] = 1u;
}
// Same Hillis-Steele stride blocks and same original sorted tail identity.
@compute @workgroup_size(1)
fn reduce_exact_capture_segments(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let position = id.x + id.y * groups.x;
  if (position >= XC_CAPACITY) { return; }
  let dest = position * XC_RECORD;
  if (!xc_bounds() || xc_reduce.stride == 0u || (xc_reduce.stride & (xc_reduce.stride - 1u)) != 0u) { xc_fail(dest, 8192u); return; }
  if (xc_count[0u] > XC_CAPACITY || xc_count[1u] != 0u) { xc_fail(dest, xc_count[1u] | 8192u); return; }
  for (var i = 0u; i < XC_RECORD; i++) { xc_output[dest + i] = xc_input[dest + i]; }
  let event = xc_sorted[position];
  if (event >= XC_CAPACITY) { xc_fail(dest, 8192u); return; }
  let receiver = xc_keys[event]; if (receiver == XC_INVALID) { return; }
  var error = xc_header_error(dest, position, receiver);
  if (event >= xc_count[0u] || receiver >= XC_PARTICLES) { error |= 8192u; }
  if (error != 0u) { xc_fail(dest, error); return; }
  if (position < xc_reduce.stride) { return; }
  let prior_position = position - xc_reduce.stride; let prior_event = xc_sorted[prior_position];
  if (prior_event >= XC_CAPACITY) { xc_fail(dest, 8192u); return; }
  if (xc_keys[prior_event] != receiver) { return; }
  let prior = prior_position * XC_RECORD;
  error |= xc_header_error(prior, prior_position, receiver);
  if (xc_input[prior + 9u] + 1u != xc_input[dest + 8u]) { error |= 8192u; }
  for (var i = 4u; i < 7u; i++) { if (xc_input[prior + i] != xc_input[dest + i]) { error |= 8192u; } }
  let count = xc_input[prior + 3u] + xc_input[dest + 3u];
  if (count < xc_input[prior + 3u] || count > XC_CAPACITY) { error |= 1u; }
  var carry = 0u;
  for (var i = 0u; i < XC_N; i++) {
    let a = xc_input[dest + 16u + i]; let b = xc_input[prior + 16u + i];
    let first = a + b; let sum = first + carry; carry = select(0u, 1u, first < a || sum < first);
    xc_output[dest + 16u + i] = sum;
  }
  if (carry != 0u) { error |= 1u; }
  if (error != 0u) { xc_fail(dest, error); return; }
  for (var field = 0u; field < 10u; field++) {
    let offset = XC_SCALAR_OFFSET + field * XC_SCALAR;
    let value = xr_add(xc_read_input(dest + offset), xc_read_input(prior + offset));
    error |= value.error; xc_store(dest + offset, value);
  }
  if (error != 0u) { xc_fail(dest, error); return; }
  xc_output[dest + 3u] = count; xc_output[dest + 7u] = max(xc_input[dest + 7u], xc_input[prior + 7u]);
  xc_output[dest + 8u] = xc_input[prior + 8u]; xc_output[dest] = 1u;
}
`;
}

export function sphExactPlacementCapturePipelineDescriptors(format, quantityLayout) {
  const layout = sphExactPlacementCaptureLayout(format, quantityLayout), code = createSphExactPlacementCaptureWgsl(format, quantityLayout);
  const key = [format.wordCount, format.quantumExponent, layout.scalar.wordCount, layout.eventCapacity,
    layout.particleCount, layout.quantityRecordWords, layout.recordWords,
    layout.quantityCurrentRowOffset, layout.quantityEventRowOffset, layout.quantityWordLength].join('-');
  const bindings = [...Array.from({ length: 8 }, (_, binding) => ({ binding, visibility: 4,
    buffer: { type: binding >= 6 ? 'storage' : 'read-only-storage' } })), { binding: 8, visibility: 4, buffer: { type: 'uniform' } }];
  const make = (suffix, entryPoint) => Object.freeze({ label: `ulg-exact-capture-${suffix}`,
    cacheKey: `ulg-exact-capture-v1-${suffix}-${key}`, code, entryPoint, bindings, workgroupSize: 1 });
  return Object.freeze({ layout, initialize: make('initialize', 'initialize_exact_capture_segments'),
    reduce: make('reduce', 'reduce_exact_capture_segments') });
}

export function planSphExactPlacementCaptureWorkgroups(eventCapacity, maxDimension) {
  checked(eventCapacity, 'dispatch capacity'); checked(maxDimension, 'dispatch limit');
  const x = Math.min(eventCapacity, maxDimension), y = Math.ceil(eventCapacity / x);
  if (y > maxDimension || x * y > 0xffffffff) throw new RangeError('Exact capture dispatch exceeds checked device capacity');
  return Object.freeze({ x, y, z: 1 });
}
