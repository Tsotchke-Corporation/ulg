import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// The original source-selection owner supplies the actual retained thermal
// records, allocation ledger, validation and submission. This is arithmetic
// inside that owner; it cannot authenticate or publish a particle source.
export function sphExactCarriedReactionProgram() {
  const operations = []; let registers = 21;
  const op = (kind, a, b) => { const out = registers++; operations.push([kind, a, b, out]); return out; };
  const add = (a, b) => op(0, a, b), sub = (a, b) => op(1, a, b);
  const mul = (a, b) => op(2, a, b), div = (a, b) => op(3, a, b);
  // Initial registers: MA,MB,da,db,PA.xyz,EA,PB.xyz,EB,urefA,urefB,
  // mass-per-extent,formation-delta,projected-v.xyz,product-U,caloric-residual.
  const fa = div(2, 0), fb = div(3, 1), mass = add(2, 3);
  const momentum = [0, 1, 2].map(axis => add(mul(4 + axis, fa), mul(8 + axis, fb)));
  const energy = add(mul(7, fa), mul(11, fb));
  const kinetic = (p, m) => div(p.map(v => mul(v, v)).reduce(add), add(m, m));
  const sourceKinetic = add(mul(kinetic([4, 5, 6], 0), fa), mul(kinetic([8, 9, 10], 1), fb));
  const internal = sub(energy, sourceKinetic), reference = add(mul(2, 12), mul(3, 13));
  const sensible = sub(energy, reference), comKinetic = kinetic(momentum, mass);
  const formation = mul(div(mass, 14), 15), target = sub(sub(sensible, comKinetic), formation);
  const velocity = momentum.map(p => div(p, mass)), beforeProjection = operations.length;
  const residualMomentum = momentum.map((p, axis) => sub(p, mul(mass, 16 + axis)));
  const projectedMomentum = [16, 17, 18].map(v => mul(mass, v));
  const projectedKinetic = kinetic(projectedMomentum, mass), balance = sub(sensible, projectedKinetic);
  const beforeCaloric = operations.length;
  const correction = sub(comKinetic, projectedKinetic), residual = add(20, correction);
  const total = add(add(19, projectedKinetic), residual);
  return Object.freeze({ registers, operations: Object.freeze(operations.map(Object.freeze)),
    beforeProjection, beforeCaloric, target, velocity: Object.freeze(velocity), mass,
    extensives: Object.freeze([...momentum, internal, sourceKinetic, reference, sensible,
      ...residualMomentum, projectedKinetic, balance]), productEnergy: Object.freeze([correction, residual, total]) });
}

export async function prepareSphExactCarriedReaction({ device, source, format, code: originalCode,
  entries, allocate, validate, caloricWordCount }) {
  validate();
  const { quantityBuffer, quantityLayout: layout } = source.quantities;
  const program = sphExactCarriedReactionProgram(), n = format.wordCount;
  const r = layout.scalar.wordCount, scalar = layout.scalar.recordWords;
  const stride = layout.recordWords, count = source.particleCount;
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const scratchBytes = count * program.registers * scalar * 4;
  if (layout.rowCount !== count || layout.massWordCount !== n || quantityBuffer.size !== count * stride * 4
      || scalar !== 4 + 2 * r || caloricWordCount > 2 * r + 1
      || !Number.isSafeInteger(scratchBytes) || scratchBytes > device.limits.maxStorageBufferBindingSize
      || scratchBytes > device.limits.maxBufferSize || device.limits.maxStorageBuffersPerShaderStage < 10
      || device.limits.maxUniformBuffersPerShaderStage < 2 || device.limits.maxBindingsPerBindGroup < 12
      || program.operations.length * alignment > device.limits.maxUniformBufferBindingSize) {
    throw new RangeError('Carried reaction quantities exceed the original source/device capacity');
  }
  const scratch = allocate('ulg-exact-carried-reaction-scratch', scratchBytes, 128 | 8);
  const instructions = allocate('ulg-exact-carried-reaction-instructions', program.operations.length * alignment, 64 | 8);
  const words = new Uint32Array(instructions.size / 4);
  program.operations.forEach((instruction, i) => words.set(instruction, i * alignment / 4));
  const createCode = (operationKind = 0) => originalCode + createSphExactRationalQuantityWgsl({ wordCount: r }) + /* wgsl */ `
@group(0) @binding(9) var<storage, read> rq_source: array<u32>;
@group(0) @binding(10) var<storage, read_write> rq_scratch: array<u32>;
@group(0) @binding(11) var<uniform> rq_instruction: vec4<u32>;
fn rq_at(row: u32, slot: u32) -> u32 { return (row * ${program.registers}u + slot) * ${scalar}u; }
fn rq_ready(row: u32) -> bool {
  let out = row * es_params.record_words;
  return es_output[out] == 1u && es_output[out + 1u] == 0u && (es_output[out + 10u] & ~32u) == 0u;
}
fn rq_fail(row: u32, error: u32) {
  let out = row * es_params.record_words; es_output[out + 10u] |= error;
  es_output[out + 9u] = 0u; es_caloric_fail(out, error);
}
fn rq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = rq_at(row, slot);
  (*v).negative = rq_scratch[at]; (*v).error = rq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(rq_scratch[at + 2u]); (*v).reserved = rq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = rq_scratch[at + 4u + i]; (*v).denominator[i] = rq_scratch[at + 4u + XR_WORDS + i]; }
}
fn rq_store(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = rq_at(row, slot); rq_scratch[at] = (*v).negative; rq_scratch[at + 1u] = (*v).error;
  rq_scratch[at + 2u] = bitcast<u32>((*v).exponent); rq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { rq_scratch[at + 4u + i] = (*v).numerator[i]; rq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i]; }
  if ((*v).error != 0u) { rq_fail(row, (*v).error); }
}
fn rq_ingress(row: u32, slot: u32, bits: u32) {
  let at = rq_at(row, slot); let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { rq_fail(row, 8192u); return; }
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  if (coefficient == 0u) { return; }
  let shift = countTrailingZeros(coefficient); rq_scratch[at] = bits >> 31u;
  rq_scratch[at + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  rq_scratch[at + 4u] = coefficient >> shift;
}
fn rq_copy_packet(row: u32, slot: u32, destination: u32) {
  let at = rq_at(row, slot);
  for (var i = 0u; i < ${scalar}u; i++) { es_output[destination + i] = rq_scratch[at + i]; }
}
@compute @workgroup_size(32)
fn prepare_carried_reaction(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  let out = row * es_params.record_words; let rx = es_output[out + 4u]; let rule = rx * 24u;
  if (!reaction_energy_enabled(rx) || !es_caloric_source_ready(rx, es_output[out + 2u])
      || !es_caloric_source_ready(rx, es_output[out + 3u])) { rq_fail(row, 4194304u); return; }
  for (var i = 0u; i < ${program.registers * scalar}u; i++) { rq_scratch[rq_at(row, 0u) + i] = 0u; }
  for (var slot = 0u; slot < ${program.registers}u; slot++) { rq_scratch[rq_at(row, slot) + 4u + XR_WORDS] = 1u; }
  for (var side = 0u; side < 2u; side++) {
    let source_row = es_output[out + 2u + side]; let base = source_row * ${stride}u;
    if (source_row >= es_params.count || rq_source[base] != 1u || rq_source[base + 1u] != 0u
        || rq_source[base + 9u] != EM_WORDS || rq_source[base + 10u] != XR_WORDS || rq_source[base + 11u] != 1u
        || rq_source[base + 2u] != u32(es_thermo[source_row * 3u].x)
        || rq_source[base + 3u] != u32(es_thermo[source_row * 3u].y)) { rq_fail(row, 8192u); return; }
    for (var i = 12u; i < 16u; i++) { if (rq_source[base + i] != 0u) { rq_fail(row, 8192u); return; } }
    let mass_slot = rq_at(row, side); let debit_slot = rq_at(row, 2u + side);
    rq_scratch[mass_slot + 2u] = bitcast<u32>(EM_QUANTUM); rq_scratch[debit_slot + 2u] = bitcast<u32>(EM_QUANTUM);
    for (var i = 0u; i < EM_WORDS; i++) {
      let mass = rq_source[base + ${layout.massOffsetWords}u + i];
      if (mass != es_inventory[es_params.inventory_word_offset + source_row * EM_WORDS + i]) { rq_fail(row, 8192u); return; }
      rq_scratch[mass_slot + 4u + i] = mass;
      rq_scratch[debit_slot + 4u + i] = es_output[out + 12u + (1u + side) * EM_WORDS + i];
    }
    for (var field = 0u; field < 4u; field++) {
      let source_at = base + ${layout.scalarOffsetWords}u + field * ${scalar}u;
      if (rq_source[source_at + 1u] != 0u || rq_source[source_at + 3u] != 0u) { rq_fail(row, 8192u); return; }
      for (var i = 0u; i < ${scalar}u; i++) { rq_scratch[rq_at(row, 4u + side * 4u + field) + i] = rq_source[source_at + i]; }
    }
    rq_ingress(row, 12u + side, es_metadata[rule + 22u + side]);
  }
  let scale_at = es_metadata[rule + 1u]; let scale_slot = rq_at(row, 14u);
  rq_scratch[scale_slot + 2u] = bitcast<u32>(bitcast<i32>(es_metadata[scale_at]) + EM_QUANTUM);
  for (var i = 0u; i < EM_WORDS + 4u; i++) { rq_scratch[scale_slot + 4u + i] = es_metadata[scale_at + 4u + i]; }
  rq_ingress(row, 15u, es_energy_bits(energy_header(rx), 1u));
}
@compute @workgroup_size(32)
fn execute_carried_reaction(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  var a: ExactRational; var b: ExactRational; var v: ExactRational;
  rq_load(row, rq_instruction.y, &a); rq_load(row, rq_instruction.z, &b);
  if (rq_instruction.x != ${operationKind}u) { v.error = 8192u; }
  else { xrp_rational_${['add', 'subtract', 'multiply', 'divide'][operationKind]}(&v, &a, &b); }
  rq_store(row, rq_instruction.w, &v);
}
@compute @workgroup_size(32)
fn project_carried_reaction(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  let out = row * es_params.record_words; let slots = array<u32, 3>(${program.velocity.map(v => `${v}u`).join(', ')});
  var error = 0u;
  for (var axis = 0u; axis < 3u; axis++) {
    var v: ExactRational; rq_load(row, slots[axis], &v); let projected = xrp_project_f32_bits(&v);
    error |= projected.error; es_output[es_extensive_start(out) + axis] = projected.bits;
    rq_ingress(row, 16u + axis, projected.bits);
  }
  es_output[es_extensive_start(out) + 3u] = error;
  if ((error & ~32u) != 0u) { rq_fail(row, error); }
}
@compute @workgroup_size(32)
fn finalize_carried_reaction_target(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  let out = row * es_params.record_words; let at = es_caloric_start(out);
  let slots = array<u32, 12>(${program.extensives.map(v => `${v}u`).join(', ')});
  for (var field = 0u; field < 12u; field++) { rq_copy_packet(row, slots[field], es_extensive_start(out) + 4u + field * ${scalar}u); }
  var v: ExactRational; rq_load(row, ${program.target}u, &v);
  let base = EM_QUANTUM - 299;
  if (v.exponent < base - 104 || v.exponent > base + i32(EC_WORDS * 32u)) { rq_fail(row, 8192u); return; }
  let fractional_shift = u32(max(0, base - v.exponent));
  var numerator: ExactCaloric; var denominator: ExactCaloric;
  numerator.negative = v.negative; numerator.error = v.error;
  for (var i = 0u; i < XR_WORDS; i++) { numerator.words[i] = v.numerator[i]; denominator.words[i] = v.denominator[i]; }
  numerator = ec_shift_left(numerator, u32(v.exponent - base + i32(fractional_shift)));
  if (numerator.error != 0u || ec_top(denominator) < 0) { rq_fail(row, numerator.error | 8192u); return; }
  es_store_caloric(out, 0u, numerator); es_store_caloric(out, 1u, denominator);
  es_output[at + 6u] = fractional_shift; es_output[at + 7u] = es_energy_bits(energy_header(es_output[out + 4u]), 1u);
  es_output[at + 8u] = 1u; es_output[at] = 2u; es_output[out + 9u] = 1u;
}
@compute @workgroup_size(32)
fn prepare_carried_product_energy(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  let out = row * es_params.record_words; let at = es_caloric_start(out);
  if (es_output[at] != 1u) { return; }
  var internal: ExactExtensive; var error = 0u;
  for (var term = 0u; term < es_output[out + 5u]; term++) {
    let source = out + 12u + 7u * EM_WORDS + term * (4u + 3u * EM_WORDS);
    let mass = es_load_output(source + 4u); let state = es_caloric_product_start(out, 2u, term);
    if (es_output[source + 3u] != 0u || es_output[state + 7u] != 0u
        || es_output[state + 3u] != select(1u, 0u, em_zero(mass))) { error |= 8192u; }
    for (var field = 0u; field < 3u; field++) { if (es_output[source + field] != es_output[state + field]) { error |= 8192u; } }
    if (!em_zero(mass)) { internal = ee_add(internal, ee_mass_scaled(mass, es_output[state + 4u])); }
  }
  if ((error | internal.error) != 0u) { rq_fail(row, error | internal.error); return; }
  var value = xr_zero(); value.negative = internal.negative; value.exponent = EM_QUANTUM - 299;
  for (var i = 0u; i < EE_WORDS; i++) { value.numerator[i] = internal.words[i]; }
  var normalized: ExactRational; xrp_normalize(&normalized, &value); rq_store(row, 19u, &normalized);
  let residual = es_load_caloric(out, 4u); let divisor = es_load_caloric(out, 1u);
  var numer: ExactRationalWide; var denom: ExactRationalWide;
  for (var i = 0u; i < EC_WORDS; i++) { numer.words[i] = residual.words[i]; denom.words[i] = divisor.words[i]; }
  numer.error = residual.error; denom.error = divisor.error | select(0u, 8192u, divisor.negative != 0u);
  xrp_finish(&normalized, &numer, &denom, residual.negative, EM_QUANTUM - 299 - i32(es_output[at + 6u]));
  rq_store(row, 20u, &normalized);
}
@compute @workgroup_size(32)
fn finalize_carried_product_energy(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= es_params.count || !rq_ready(row)) { return; }
  let out = row * es_params.record_words; let caloric = es_caloric_start(out);
  if (es_output[caloric] != 1u) { return; }
  let at = caloric + es_params.caloric_record_words;
  let slots = array<u32, 3>(${program.productEnergy.map(v => `${v}u`).join(', ')});
  for (var field = 0u; field < 3u; field++) { rq_copy_packet(row, slots[field], at + 8u + field * ${scalar}u); }
  es_output[at] = 1u; es_output[at + 4u] = es_output[es_extensive_start(out) + 3u];
}
`;
  const bindings = [...entries.map((_, index) => computeBufferBinding(index,
    index === 8 ? 'uniform' : index === 6 ? 'storage' : 'read-only-storage')),
    computeBufferBinding(9, 'read-only-storage'), computeBufferBinding(10, 'storage'), computeBufferBinding(11, 'uniform')];
  const pipelines = new Map();
  const descriptors = [
    ...['prepare_carried_reaction', 'project_carried_reaction', 'finalize_carried_reaction_target',
      'prepare_carried_product_energy', 'finalize_carried_product_energy'].map(entryPoint => ({ key: entryPoint, entryPoint })),
    ...['add', 'subtract', 'multiply', 'divide'].map((name, kind) => ({ key: kind, kind,
      entryPoint: 'execute_carried_reaction', label: `execute_carried_reaction_${name}` }))
  ];
  for (const { key, entryPoint, label = entryPoint, kind = 0 } of descriptors) {
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code: createCode(kind), entryPoint, bindings,
      cacheKey: `ulg-${label}-v2-${n}-${format.quantumExponent}-${r}-${caloricWordCount}`,
      label: `ulg-${label}` });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Carried reaction ${entryPoint} unavailable`);
    validate(); pipelines.set(key, pipeline);
  }
  device.queue.writeBuffer(instructions, 0, words);
  const groups = new Map();
  const dispatch = (encoder, entryPoint, instruction = 0) => {
    const key = `${entryPoint}:${instruction}`, pipeline = pipelines.get(entryPoint);
    let group = groups.get(key);
    if (!group) {
      group = device.createBindGroup({ layout: pipeline.bindGroupLayout, entries: [...entries,
        { binding: 9, resource: { buffer: quantityBuffer } }, { binding: 10, resource: { buffer: scratch } },
        { binding: 11, resource: { buffer: instructions, offset: instruction * alignment, size: 16 } }] });
      groups.set(key, group);
    }
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(Math.ceil(count / 32)); pass.end();
  };
  const execute = (encoder, start, end) => {
    for (let i = start; i < end; i++) dispatch(encoder, program.operations[i][0], i);
  };
  return Object.freeze({ encodeTarget(encoder) {
    dispatch(encoder, 'prepare_carried_reaction'); execute(encoder, 0, program.beforeProjection);
    dispatch(encoder, 'project_carried_reaction'); execute(encoder, program.beforeProjection, program.beforeCaloric);
    dispatch(encoder, 'finalize_carried_reaction_target');
  }, encodeProductEnergy(encoder) {
    dispatch(encoder, 'prepare_carried_product_energy'); execute(encoder, program.beforeCaloric, program.operations.length);
    dispatch(encoder, 'finalize_carried_product_energy');
  } });
}
