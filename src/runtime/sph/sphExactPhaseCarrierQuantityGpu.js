import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { computeBufferBinding, createCachedExplicitBindGroup, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { SPH_EXACT_MASS_ERROR as E } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

// Arithmetic only. The physical phase producer authenticates inputs, supplies
// actual caloric endpoints/constitutive metadata, submits and owns retirement.
export async function prepareSphExactPhaseCarrierQuantities({ device, format, layout,
  sourceQuantityBuffer, packetMassBuffer, candidateMassBuffer, geometryBuffer,
  validationBuffer, lineageCapacity, allocate, validate }) {
  validate();
  const count = lineageCapacity * 4, scalar = layout.scalar.recordWords, stride = layout.recordWords;
  const registers = 24, alignment = device.limits.minUniformBufferOffsetAlignment;
  const size = count * stride * 4, scratchSize = count * registers * scalar * 4;
  const packetSize = count * 16 * scalar * 4;
  const normalizationQueueSize = (4 + count * 2) * 4;
  if (layout.rowCount !== count || layout.massOffsetWords !== 16 || layout.scalarOffsetWords !== 16 + format.wordCount
      || size !== sourceQuantityBuffer.size || packetMassBuffer.size !== count * 4 * format.wordCount * 4
      || candidateMassBuffer.size !== count * format.wordCount * 4 || geometryBuffer.size !== count * 32
      || ![size, scratchSize, packetSize, normalizationQueueSize].every(n => Number.isSafeInteger(n)
        && n <= device.limits.maxStorageBufferBindingSize && n <= device.limits.maxBufferSize)
      || Math.ceil(count * 8 / 32) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact phase quantities require complete four-lane records within device capacity');
  }
  const operations = [];
  const operation = (mode, phase, kind, a, b, out) => operations.push({ mode, phase, instruction: [kind, a, b, out] });
  // Source registers: M,Px,Py,Pz,E,packetM,componentU,remaining(Px,Py,Pz,E).
  const source = (kind, a, b, out) => operation(0, 0, kind, a, b, out);
  source(2, 1, 1, 12); source(2, 2, 2, 13); source(0, 12, 13, 12);
  source(2, 3, 3, 13); source(0, 12, 13, 12); source(0, 0, 0, 13);
  source(3, 12, 13, 14); source(3, 14, 0, 14); // K/M
  const sourceOperations = operations.length;
  const phaseRanges = [];
  for (let phase = 0; phase < 4; phase++) {
    const start = operations.length, op = (kind, a, b, out) => operation(1, phase, kind, a, b, out);
    op(3, 5, 0, 15);
    for (let axis = 0; axis < 3; axis++) op(2, axis + 1, 15, axis + 17);
    op(0, 6, 14, 16); op(2, 5, 16, 20);
    phaseRanges.push([start, operations.length]);
    for (let field = 0; field < 4; field++) op(1, field + 7, field + 17, field + 7);
  }
  const targetStart = operations.length;
  const target = (kind, a, b, out) => operation(2, 0, kind, a, b, out);
  target(2, 1, 1, 12); target(2, 2, 2, 13); target(0, 12, 13, 12);
  target(2, 3, 3, 13); target(0, 12, 13, 12); target(0, 0, 0, 13);
  target(3, 12, 13, 14); target(1, 4, 14, 16); target(3, 16, 0, 16);
  for (let axis = 0; axis < 3; axis++) target(3, axis + 1, 0, axis + 17);
  target(3, 0, 5, 9); target(3, 6, 7, 8); target(2, 9, 8, 10);
  const make = (label, bytes, usage = 128 | 4 | 8) => allocate({ label: `ulg-exact-phase-${label}`, size: bytes, usage });
  const quantityBuffer = make('quantities', size), scratch = make('quantity-scratch', scratchSize);
  const packetQuantityBuffer = make('packet-quantities', packetSize), projectionBuffer = make('projection', count * 32);
  const params = make('quantity-params', alignment * (operations.length + 6), 64 | 8);
  const instructions = make('quantity-operations', alignment * operations.length, 64 | 8);
  const normalizationQueue = make('quantity-normalization-queue', normalizationQueueSize);
  // Keep indirect arguments outside the bind group: the queued normalizer
  // reads its work list as storage while dispatch consumes a separate buffer.
  const normalizationDispatch = make('quantity-normalization-dispatch', 12, 256 | 8);
  const parameterWords = new Uint32Array(params.size / 4), instructionWords = new Uint32Array(instructions.size / 4);
  operations.forEach((op, i) => { parameterWords.set([count, lineageCapacity, op.mode, op.phase], i * alignment / 4);
    instructionWords.set(op.instruction, i * alignment / 4); });
  // Stable parameter rows for preparation, per-phase packet stores and targets.
  for (let i = 0; i < 6; i++) parameterWords.set([count, lineageCapacity, i === 5 ? 2 : i === 0 ? 0 : 1, Math.max(0, i - 1)],
    (operations.length + i) * alignment / 4);
  device.queue.writeBuffer(params, 0, parameterWords); device.queue.writeBuffer(instructions, 0, instructionWords);
  const body = /* wgsl */ `
@group(0) @binding(0) var<storage, read> pq_source: array<u32>;
@group(0) @binding(1) var<storage, read> pq_mass_packets: array<u32>;
@group(0) @binding(2) var<storage, read> pq_mass: array<u32>;
@group(0) @binding(3) var<storage, read> pq_geometry: array<u32>;
@group(0) @binding(4) var<storage, read_write> pq_scratch: array<u32>;
@group(0) @binding(5) var<storage, read_write> pq_packets: array<u32>;
@group(0) @binding(6) var<storage, read_write> pq_output: array<u32>;
@group(0) @binding(7) var<storage, read_write> pq_projection: array<u32>;
@group(0) @binding(8) var<storage, read_write> pq_validation: array<atomic<u32>>;
@group(0) @binding(9) var<uniform> pq_params: vec4<u32>;
@group(0) @binding(10) var<uniform> pq_op: vec4<u32>;
@group(0) @binding(11) var<storage, read_write> pq_normalization: array<atomic<u32>>;
fn pq_at(row: u32, slot: u32) -> u32 { return (row * ${registers}u + slot) * ${scalar}u; }
fn pq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = pq_at(row, slot);
  (*v).negative = pq_scratch[at]; (*v).error = pq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(pq_scratch[at + 2u]); (*v).reserved = pq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = pq_scratch[at + 4u + i]; (*v).denominator[i] = pq_scratch[at + 4u + XR_WORDS + i]; }
}
fn pq_store(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = pq_at(row, slot); pq_scratch[at] = (*v).negative; pq_scratch[at + 1u] = (*v).error;
  pq_scratch[at + 2u] = bitcast<u32>((*v).exponent); pq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { pq_scratch[at + 4u + i] = (*v).numerator[i]; pq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i]; }
  if ((*v).error != 0u) { atomicOr(&pq_validation[0], (*v).error); }
}
fn pq_source_scalar(row: u32, field: u32, v: ptr<function, ExactRational>) {
  let at = row * ${stride}u + ${layout.scalarOffsetWords}u + field * ${scalar}u;
  (*v).negative = pq_source[at]; (*v).error = pq_source[at + 1u]; (*v).exponent = bitcast<i32>(pq_source[at + 2u]); (*v).reserved = pq_source[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = pq_source[at + 4u + i]; (*v).denominator[i] = pq_source[at + 4u + XR_WORDS + i]; }
}
fn pq_active(row: u32) -> bool {
  var mass = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass |= select(pq_source[row * ${stride}u + 16u + i], pq_mass[row * ${format.wordCount}u + i], pq_params.z == 2u); }
  return mass != 0u;
}
fn pq_packet_active(row: u32, phase: u32) -> bool {
  var mass = 0u; for (var i = 0u; i < ${format.wordCount}u; i++) { mass |= pq_mass_packets[(row * 4u + phase) * ${format.wordCount}u + i]; }
  return mass != 0u;
}
fn pq_clear_scratch(row: u32) {
  for (var i = 0u; i < ${registers * scalar}u; i++) { pq_scratch[pq_at(row, 0u) + i] = 0u; }
  for (var slot = 0u; slot < ${registers}u; slot++) { pq_scratch[pq_at(row, slot) + 4u + XR_WORDS] = 1u; }
}
fn pq_zero_scalar(row: u32, slot: u32, error: u32) {
  let at = pq_at(row, slot);
  for (var i = 0u; i < ${scalar}u; i++) { pq_scratch[at + i] = 0u; }
  pq_scratch[at + 1u] = error; pq_scratch[at + 4u + XR_WORDS] = 1u;
  if (error != 0u) { atomicOr(&pq_validation[0], error); }
}
// Zero and power-of-two denominators need no wide GCD temporaries. Check
// the same input headers and exponent adjustment before changing any words.
fn pq_normalize_dyadic(row: u32, slot: u32) -> bool {
  let at = pq_at(row, slot); var nt = XR_WORDS * 32u; var dt = nt; var denominator_bits = 0u;
  for (var i = 0u; i < XR_WORDS; i++) {
    let n = pq_scratch[at + 4u + i]; let d = pq_scratch[at + 4u + XR_WORDS + i];
    if (n != 0u && nt == XR_WORDS * 32u) { nt = i * 32u + countTrailingZeros(n); }
    if (d != 0u && dt == XR_WORDS * 32u) { dt = i * 32u + countTrailingZeros(d); }
    denominator_bits += countOneBits(d);
  }
  var error = pq_scratch[at + 1u];
  if (pq_scratch[at] > 1u || pq_scratch[at + 3u] != 0u
      || (nt == XR_WORDS * 32u && pq_scratch[at] != 0u)) { error |= ${E.INVALID_RATIO}u; }
  if (denominator_bits == 0u) { error |= ${E.DIVISION_BY_ZERO}u; }
  if (error != 0u || nt == XR_WORDS * 32u) { pq_zero_scalar(row, slot, error); return true; }
  if (denominator_bits != 1u) { return false; }
  let exponent = xr_exponent_add(bitcast<i32>(pq_scratch[at + 2u]), i32(nt) - i32(dt));
  if (exponent.error != 0u) { pq_zero_scalar(row, slot, exponent.error); return true; }
  let whole = nt / 32u; let part = nt % 32u;
  // Ascending writes read only their own or higher untouched numerator words.
  for (var i = 0u; i < XR_WORDS; i++) {
    let source = i + whole; var word = 0u;
    if (source < XR_WORDS) {
      word = pq_scratch[at + 4u + source] >> part;
      if (part != 0u && source + 1u < XR_WORDS) { word |= pq_scratch[at + 5u + source] << (32u - part); }
    }
    pq_scratch[at + 4u + i] = word;
    pq_scratch[at + 4u + XR_WORDS + i] = select(0u, 1u, i == 0u);
  }
  pq_scratch[at + 2u] = bitcast<u32>(exponent.value);
  return true;
}
fn pq_scalar_zero(row: u32, slot: u32) -> bool {
  let at = pq_at(row, slot); var bits = 0u;
  for (var i = 0u; i < XR_WORDS; i++) { bits |= pq_scratch[at + 4u + i]; }
  return bits == 0u;
}
fn pq_copy_scalar(row: u32, destination: u32, source: u32, negate: bool) {
  let source_at = pq_at(row, source); let destination_at = pq_at(row, destination); let sign = pq_scratch[source_at];
  for (var i = 0u; i < ${scalar}u; i++) { pq_scratch[destination_at + i] = pq_scratch[source_at + i]; }
  pq_scratch[destination_at] = sign ^ select(0u, 1u, negate);
}
// Inputs passed the preceding normalization barrier. These exact identities
// avoid creating private wide arrays for zero momentum/energy components.
fn pq_zero_operation(row: u32) -> bool {
  let az = pq_scalar_zero(row, pq_op.y); let bz = pq_scalar_zero(row, pq_op.z);
  if (pq_op.x <= 1u) {
    if (az) { pq_copy_scalar(row, pq_op.w, pq_op.z, pq_op.x == 1u && !bz); return true; }
    if (bz) { pq_copy_scalar(row, pq_op.w, pq_op.y, false); return true; }
  }
  if (pq_op.x == 2u && (az || bz)) { pq_zero_scalar(row, pq_op.w, 0u); return true; }
  if (pq_op.x == 3u && (az || bz)) {
    pq_zero_scalar(row, pq_op.w, select(0u, ${E.DIVISION_BY_ZERO}u, bz)); return true;
  }
  return false;
}
@compute @workgroup_size(32)
fn prepare_phase_source(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; } pq_clear_scratch(row);
  for (var i = 0u; i < ${16 * scalar}u; i++) { pq_packets[row * ${16 * scalar}u + i] = 0u; }
  for (var field = 0u; field < 16u; field++) { pq_packets[(row * 16u + field) * ${scalar}u + 4u + XR_WORDS] = 1u; }
  if (!pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  if (pq_source[row * ${stride}u] != 1u || pq_source[row * ${stride}u + 1u] != 0u) { atomicOr(&pq_validation[0], 1u); return; }
  // These are serialized copies, not arithmetic. Scratch clearing established
  // the zero headers and unit denominators; avoid materializing wide private
  // rational temporaries merely to copy their words back to storage.
  let mass_at = pq_at(row, 0u);
  pq_scratch[mass_at + 2u] = bitcast<u32>(${format.quantumExponent}i);
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    pq_scratch[mass_at + 4u + i] = pq_source[row * ${stride}u + 16u + i];
  }
  for (var field = 0u; field < 4u; field++) {
    let source_at = row * ${stride}u + ${layout.scalarOffsetWords}u + field * ${scalar}u;
    let value_at = pq_at(row, field + 1u); let remaining_at = pq_at(row, field + 7u);
    for (var i = 0u; i < ${scalar}u; i++) {
      let word = pq_source[source_at + i]; pq_scratch[value_at + i] = word; pq_scratch[remaining_at + i] = word;
    }
    if (pq_source[source_at + 1u] != 0u) { atomicOr(&pq_validation[0], pq_source[source_at + 1u]); }
  }
}
@compute @workgroup_size(32)
fn seed_phase_packet(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var mass = xr_zero(); mass.exponent = ${format.quantumExponent}i;
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass.numerator[i] = pq_mass_packets[(row * 4u + pq_params.w) * ${format.wordCount}u + i]; }
  pq_store(row, 5u, &mass); var u = xr_zero();
  if (pq_packet_active(row, pq_params.w)) { xrp_from_f32_bits(&u, pq_geometry[row * 8u + pq_params.w]); }
  pq_store(row, 6u, &u);
}
@compute @workgroup_size(32)
fn initialize_phase_quantity_normalization(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x != 0u) { return; }
  atomicStore(&pq_normalization[0], 0u); atomicStore(&pq_normalization[1], 0u);
  atomicStore(&pq_normalization[2], 1u); atomicStore(&pq_normalization[3], 1u);
}
@compute @workgroup_size(32)
fn normalize_phase_quantity_operands(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 2u; let operand = id.x % 2u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  // Equal input slots have one writer. Distinct slots are independent until
  // the following arithmetic pass, including operations that overwrite one.
  if (operand == 1u && pq_op.y == pq_op.z) { return; }
  let slot = select(pq_op.y, pq_op.z, operand == 1u);
  if (pq_normalize_dyadic(row, slot)) { return; }
  let index = atomicAdd(&pq_normalization[0], 1u);
  atomicStore(&pq_normalization[4u + index], id.x);
  atomicMax(&pq_normalization[1], (index + 32u) / 32u);
}
@compute @workgroup_size(32)
fn normalize_phase_quantity_general(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= atomicLoad(&pq_normalization[0]) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let encoded = atomicLoad(&pq_normalization[4u + id.x]);
  let row = encoded / 2u; let slot = select(pq_op.y, pq_op.z, encoded % 2u == 1u);
  var source: ExactRational; var canonical: ExactRational;
  pq_load(row, slot, &source); xrp_normalize(&canonical, &source);
  pq_store(row, slot, &canonical);
}
@compute @workgroup_size(32)
fn prepare_phase_quantity_operation(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  if (pq_zero_operation(row)) { return; }
  let index = atomicAdd(&pq_normalization[0], 1u);
  atomicStore(&pq_normalization[4u + index], row);
  atomicMax(&pq_normalization[1], (index + 32u) / 32u);
}
@compute @workgroup_size(32)
fn execute_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= atomicLoad(&pq_normalization[0]) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let row = atomicLoad(&pq_normalization[4u + id.x]);
  var a: ExactRational; var b: ExactRational; var v: ExactRational;
  pq_load(row, pq_op.y, &a); pq_load(row, pq_op.z, &b);
  switch pq_op.x {
    case 0u: { xrp_rational_add(&v, &a, &b); }
    case 1u: { xrp_rational_subtract(&v, &a, &b); }
    case 2u: { xrp_rational_multiply(&v, &a, &b); }
    case 3u: { xrp_rational_divide(&v, &a, &b); }
    default: { xrp_failure(&v, 1u); }
  }
  pq_store(row, pq_op.w, &v);
}
@compute @workgroup_size(32)
fn store_phase_packet(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var last_phase = 0u; for (var phase = 0u; phase < 4u; phase++) { if (pq_packet_active(row, phase)) { last_phase = phase; } }
  for (var field = 0u; field < 4u; field++) {
    if (pq_params.w == last_phase) {
      var value: ExactRational; pq_load(row, field + 7u, &value); pq_store(row, field + 17u, &value);
    }
    let at = pq_at(row, field + 17u); let destination = ((row * 4u + pq_params.w) * 4u + field) * ${scalar}u;
    for (var i = 0u; i < ${scalar}u; i++) { pq_packets[destination + i] = pq_scratch[at + i]; }
  }
}
@compute @workgroup_size(32)
fn prepare_phase_target(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; } pq_clear_scratch(row);
  if (!pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var mass = xr_zero(); mass.exponent = ${format.quantumExponent}i;
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass.numerator[i] = pq_mass[row * ${format.wordCount}u + i]; }
  pq_store(row, 0u, &mass); var density = xr_zero(); xrp_from_f32_bits(&density, pq_geometry[row * 8u + 6u]); pq_store(row, 5u, &density);
  let template_row = pq_geometry[row * 8u + 4u];
  if (template_row >= pq_params.x) { atomicOr(&pq_validation[0], 1u); return; }
  if (pq_geometry[row * 8u + 5u] == 1u) {
    var current: ExactRational; var reference: ExactRational;
    pq_source_scalar(template_row, 5u, &current); pq_source_scalar(template_row, 4u, &reference);
    pq_store(row, 6u, &current); pq_store(row, 7u, &reference);
  } else {
    var one = xr_zero(); one.numerator[0] = 1u; pq_store(row, 6u, &one); pq_store(row, 7u, &one);
  }
}
@compute @workgroup_size(32)
fn gather_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 4u; let field = id.x % 4u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var sum = xr_zero();
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * pq_params.y + row % pq_params.y;
    let at = ((source_row * 4u + row / pq_params.y) * 4u + field) * ${scalar}u;
    var value = xr_zero(); value.negative = pq_packets[at]; value.error = pq_packets[at + 1u];
    value.exponent = bitcast<i32>(pq_packets[at + 2u]); value.reserved = pq_packets[at + 3u];
    for (var i = 0u; i < XR_WORDS; i++) { value.numerator[i] = pq_packets[at + 4u + i]; value.denominator[i] = pq_packets[at + 4u + XR_WORDS + i]; }
    var combined = xr_zero(); xrp_rational_add(&combined, &sum, &value); xrp_rational_copy(&sum, &combined);
  }
  pq_store(row, field + 1u, &sum);
}
@compute @workgroup_size(32)
fn project_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 8u; let field = id.x % 8u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let slots = array<u32, 8>(0u, 17u, 18u, 19u, 16u, 9u, 10u, 8u);
  var value: ExactRational; pq_load(row, slots[field], &value); let projected = xrp_project_f32_bits(&value);
  if (projected.error != 0u || (projected.bits & 0x7fffffffu) >= 0x7f800000u
      || ((field == 0u || field >= 5u) && ((projected.bits & 0x80000000u) != 0u || projected.bits < 0x00800000u))) {
    atomicOr(&pq_validation[0], projected.error | 1u);
  }
  pq_projection[row * 8u + field] = projected.bits;
}
@compute @workgroup_size(32)
fn commit_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; }
  let base = row * ${stride}u;
  if (atomicLoad(&pq_validation[0]) != 0u) {
    for (var i = 0u; i < ${stride}u; i++) { pq_output[base + i] = pq_source[base + i]; } return;
  }
  for (var i = 0u; i < ${stride}u; i++) { pq_output[base + i] = 0u; }
  for (var field = 0u; field < 7u; field++) { pq_output[base + ${layout.scalarOffsetWords}u + field * ${scalar}u + 4u + XR_WORDS] = 1u; }
  if (!pq_active(row)) { return; }
  let template_row = pq_geometry[row * 8u + 4u];
  for (var i = 0u; i < 16u; i++) { pq_output[base + i] = pq_source[template_row * ${stride}u + i]; }
  pq_output[base + 3u] = row / pq_params.y + 1u; pq_output[base + 6u] = row;
  for (var i = 0u; i < ${format.wordCount}u; i++) { pq_output[base + 16u + i] = pq_mass[row * ${format.wordCount}u + i]; }
  let fields = array<u32, 7>(1u, 2u, 3u, 4u, 9u, 10u, 0u);
  for (var field = 0u; field < 7u; field++) {
    let at = pq_at(row, fields[field]); let destination = base + ${layout.scalarOffsetWords}u + field * ${scalar}u;
    for (var i = 0u; i < ${scalar}u; i++) { pq_output[destination + i] = pq_scratch[at + i]; }
  }
}
`;
  const code = createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount }) + body;
  // Only the operation pipeline consumes the preceding normalization pass.
  // Gather and projection retain their ordinary boundary normalization.
  const arithmeticCode = createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount,
    canonicalOperands: true }) + body;
  const resources = [sourceQuantityBuffer, packetMassBuffer, candidateMassBuffer, geometryBuffer,
    scratch, packetQuantityBuffer, quantityBuffer, projectionBuffer, validationBuffer, params, instructions, normalizationQueue];
  const types = [...Array(4).fill('read-only-storage'), ...Array(5).fill('storage'), 'uniform', 'uniform', 'storage'];
  const pipelines = new Map();
  // Compile each arithmetic operation separately. Keeping the runtime switch
  // combines all four wide-integer call graphs into one driver pipeline and
  // makes the full-width format impractical to compile. The numerical program
  // and its queue order remain identical.
  const operationNames = ['add', 'subtract', 'multiply', 'divide'];
  const genericOperation = /  switch pq_op\.x \{[\s\S]*?\n  \}\n  pq_store\(row, pq_op\.w, &v\);/;
  const descriptors = ['prepare_phase_source', 'seed_phase_packet', 'store_phase_packet',
    'initialize_phase_quantity_normalization', 'normalize_phase_quantity_operands', 'normalize_phase_quantity_general',
    'prepare_phase_quantity_operation',
    'prepare_phase_target', 'gather_phase_quantity', 'project_phase_quantity', 'commit_phase_quantity']
    .map(entryPoint => ({ key: entryPoint, entryPoint, code }));
  operationNames.forEach(name => descriptors.push({ key: `execute_phase_${name}`, entryPoint: 'execute_phase_quantity',
    code: arithmeticCode.replace(genericOperation, `  xrp_rational_${name}(&v, &a, &b);\n  pq_store(row, pq_op.w, &v);`) }));
  for (const descriptor of descriptors) {
    const { key, entryPoint } = descriptor;
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code: descriptor.code, entryPoint,
      cacheKey: `ulg-${key}-v9:${format.wordCount}:${format.quantumExponent}:${layout.scalar.wordCount}`,
      label: `ulg-${key}`, bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact phase quantity pipeline unavailable: ${entryPoint}`);
    validate(); pipelines.set(key, pipeline);
  }
  const dispatch = (encoder, name, parameterRow, operationRow = 0, multiplier = 1) => {
    const p = pipelines.get(name), bindGroup = createCachedExplicitBindGroup(device, { layout: p.bindGroupLayout,
      entries: resources.map((buffer, binding) => ({ binding, resource: binding === 9 || binding === 10
        ? { buffer, offset: (binding === 9 ? parameterRow : operationRow) * alignment, size: 16 } : { buffer } })) });
    const pass = encoder.beginComputePass({ label: name }); pass.setPipeline(p.pipeline); pass.setBindGroup(0, bindGroup);
    if (name === 'normalize_phase_quantity_general' || name.startsWith('execute_phase_')) {
      pass.dispatchWorkgroupsIndirect(normalizationDispatch, 0);
    }
    else pass.dispatchWorkgroups(name === 'initialize_phase_quantity_normalization' ? 1 : Math.ceil(count * multiplier / 32));
    pass.end();
  };
  const execute = (encoder, start, end) => { for (let i = start; i < end; i++) {
    dispatch(encoder, 'initialize_phase_quantity_normalization', i, i);
    dispatch(encoder, 'normalize_phase_quantity_operands', i, i, 2);
    encoder.copyBufferToBuffer(normalizationQueue, 4, normalizationDispatch, 0, 12);
    dispatch(encoder, 'normalize_phase_quantity_general', i, i);
    // Reuse the work list after the normalization barrier. Simple zero
    // identities finish in storage; only other active rows launch wide math.
    dispatch(encoder, 'initialize_phase_quantity_normalization', i, i);
    dispatch(encoder, 'prepare_phase_quantity_operation', i, i);
    encoder.copyBufferToBuffer(normalizationQueue, 4, normalizationDispatch, 0, 12);
    dispatch(encoder, `execute_phase_${operationNames[operations[i].instruction[0]]}`, i, i);
  } };
  return Object.freeze({ quantityBuffer, quantityLayout: layout, format, packetQuantityBuffer, projectionBuffer,
    transientBuffers: Object.freeze([scratch, params, instructions, normalizationQueue, normalizationDispatch]),
    encode(encoder) {
      validate(); dispatch(encoder, 'prepare_phase_source', operations.length);
      execute(encoder, 0, sourceOperations);
      for (let phase = 0; phase < 4; phase++) {
        dispatch(encoder, 'seed_phase_packet', operations.length + phase + 1);
        const [start, end] = phaseRanges[phase]; execute(encoder, start, end);
        dispatch(encoder, 'store_phase_packet', operations.length + phase + 1);
        execute(encoder, end, end + 4);
      }
      dispatch(encoder, 'prepare_phase_target', operations.length + 5);
      dispatch(encoder, 'gather_phase_quantity', operations.length + 5, 0, 4);
      execute(encoder, targetStart, operations.length);
      dispatch(encoder, 'project_phase_quantity', operations.length + 5, 0, 8);
    },
    commit(encoder) { validate(); dispatch(encoder, 'commit_phase_quantity', operations.length + 5); }
  });
}
