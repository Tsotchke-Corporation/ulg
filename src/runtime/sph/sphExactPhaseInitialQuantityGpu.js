import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { computeBufferBinding, createCachedExplicitBindGroup, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// Numerical initialization for a genuine thermal capture which has no prior
// extensive-quantity owner. The calling phase producer retains the original
// inventory and thermal/mechanics tuple. A carried quantity plane must never
// be replaced with this projected-state initialization.
export async function prepareSphExactPhaseInitialQuantities({ device, format, layout,
  massBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, quantityBuffer,
  materialMolars, allocate, validate }) {
  const count = layout.rowCount, scalar = layout.scalar.recordWords, stride = layout.recordWords;
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const operations = [[2, 0, 1, 8], [2, 0, 2, 9], [2, 0, 3, 10],
    [2, 1, 1, 11], [2, 2, 2, 12], [0, 11, 12, 11], [2, 3, 3, 12], [0, 11, 12, 11],
    [2, 11, 7, 11], [0, 11, 4, 11], [2, 11, 0, 11], [2, 5, 6, 12]];
  const scratch = allocate({ label: 'ulg-phase-initial-quantity-scratch', size: count * 13 * scalar * 4, usage: 128 | 8 });
  const molars = allocate({ label: 'ulg-phase-initial-molar-identities', size: Math.max(8, materialMolars.byteLength), usage: 128 | 8 });
  const params = allocate({ label: 'ulg-phase-initial-quantity-operations', size: operations.length * alignment, usage: 64 | 8 });
  const words = new Uint32Array(params.size / 4); operations.forEach((op, i) => words.set(op, i * alignment / 4));
  device.queue.writeBuffer(params, 0, words); device.queue.writeBuffer(molars, 0, materialMolars);
  const code = createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount }) + /* wgsl */ `
@group(0) @binding(0) var<storage, read> initial_mass: array<u32>;
@group(0) @binding(1) var<storage, read> initial_state: array<u32>;
@group(0) @binding(2) var<storage, read> initial_thermo: array<u32>;
@group(0) @binding(3) var<storage, read> initial_mechanics: array<u32>;
@group(0) @binding(4) var<storage, read> initial_molars: array<u32>;
@group(0) @binding(5) var<storage, read_write> initial_scratch: array<u32>;
@group(0) @binding(6) var<storage, read_write> initial_quantities: array<u32>;
@group(0) @binding(7) var<uniform> initial_op: vec4<u32>;
fn initial_store(row: u32, slot: u32, v: ExactRational) {
  let at = (row * 13u + slot) * ${scalar}u;
  initial_scratch[at] = v.negative; initial_scratch[at + 1u] = v.error;
  initial_scratch[at + 2u] = bitcast<u32>(v.exponent); initial_scratch[at + 3u] = v.reserved;
  for (var i = 0u; i < XR_WORDS; i++) { initial_scratch[at + 4u + i] = v.numerator[i]; initial_scratch[at + 4u + XR_WORDS + i] = v.denominator[i]; }
  initial_quantities[row * ${stride}u + 1u] |= v.error;
}
fn initial_load(row: u32, slot: u32) -> ExactRational {
  let at = (row * 13u + slot) * ${scalar}u; var v = xr_zero();
  v.negative = initial_scratch[at]; v.error = initial_scratch[at + 1u];
  v.exponent = bitcast<i32>(initial_scratch[at + 2u]); v.reserved = initial_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { v.numerator[i] = initial_scratch[at + 4u + i]; v.denominator[i] = initial_scratch[at + 4u + XR_WORDS + i]; }
  return v;
}
@compute @workgroup_size(32)
fn seed_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${count}u) { return; } let at = row * ${stride}u;
  for (var i = 0u; i < ${stride}u; i++) { initial_quantities[at + i] = 0u; }
  for (var slot = 0u; slot < 13u; slot++) { initial_store(row, slot, xr_zero()); }
  var mass = xr_zero(); mass.exponent = ${format.quantumExponent}i; var has_mass = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    mass.numerator[i] = initial_mass[row * ${format.wordCount}u + i]; has_mass |= mass.numerator[i];
    initial_quantities[at + 16u + i] = mass.numerator[i];
  }
  let material = u32(bitcast<f32>(initial_thermo[row * 12u]));
  initial_quantities[at] = 1u; initial_quantities[at + 2u] = material;
  initial_quantities[at + 3u] = u32(bitcast<f32>(initial_thermo[row * 12u + 1u]));
  initial_quantities[at + 5u] = 1u; initial_quantities[at + 6u] = row;
  initial_quantities[at + 7u] = 0xffffffffu; initial_quantities[at + 8u] = 0xffffffffu;
  initial_quantities[at + 9u] = ${format.wordCount}u; initial_quantities[at + 10u] = XR_WORDS;
  initial_quantities[at + 11u] = select(0u, 1u, has_mass != 0u);
  if (has_mass == 0u) { return; }
  for (var i = 0u; i + 1u < arrayLength(&initial_molars); i += 2u) {
    if (initial_molars[i] == material) { initial_quantities[at + 4u] = initial_molars[i + 1u]; }
  }
  let molar_bits = initial_quantities[at + 4u];
  if (molar_bits < 0x00800000u || molar_bits >= 0x7f800000u) { initial_quantities[at + 1u] |= 1u; }
  initial_store(row, 0u, mass);
  for (var field = 0u; field < 4u; field++) { var value = xr_zero();
    xrp_from_f32_bits(&value, initial_state[row * 8u + 4u + field]); initial_store(row, field + 1u, value); }
  for (var field = 0u; field < 2u; field++) { var value = xr_zero();
    xrp_from_f32_bits(&value, initial_mechanics[row * 32u + 19u - field]); initial_store(row, field + 5u, value); }
  var half = xr_zero(); xrp_from_f32_bits(&half, 0x3f000000u); initial_store(row, 7u, half);
}
@compute @workgroup_size(32)
fn calculate_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${count}u || initial_quantities[row * ${stride}u + 11u] == 0u) { return; }
  var a = initial_load(row, initial_op.y); var b = initial_load(row, initial_op.z); var value = xr_zero();
  if (initial_op.x == 0u) { xrp_rational_add(&value, &a, &b); } else { xrp_rational_multiply(&value, &a, &b); }
  initial_store(row, initial_op.w, value);
}
@compute @workgroup_size(32)
fn finish_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${count}u) { return; }
  let fields = array<u32, 7>(8u, 9u, 10u, 11u, 5u, 12u, 0u);
  for (var field = 0u; field < 7u; field++) {
    let input = (row * 13u + fields[field]) * ${scalar}u;
    let output = row * ${stride}u + ${layout.scalarOffsetWords}u + field * ${scalar}u;
    for (var i = 0u; i < ${scalar}u; i++) { initial_quantities[output + i] = initial_scratch[input + i]; }
  }
}
`;
  const resources = [massBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, molars, scratch, quantityBuffer, params];
  const pipelines = [];
  for (const entryPoint of ['seed_phase_initial_quantities', 'calculate_phase_initial_quantities', 'finish_phase_initial_quantities']) {
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
      cacheKey: `ulg-${entryPoint}-v2:${format.wordCount}:${format.quantumExponent}:${count}:${layout.scalar.wordCount}`,
      bindings: [...Array(5).fill('read-only-storage'), 'storage', 'storage', 'uniform'].map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Initial phase quantities unavailable: ${entryPoint}`);
    pipelines.push(pipeline); validate();
  }
  const dispatch = (encoder, index, operation = 0) => {
    const pipeline = pipelines[index], group = createCachedExplicitBindGroup(device, { layout: pipeline.bindGroupLayout,
      entries: resources.map((buffer, binding) => ({ binding, resource: binding === 7
        ? { buffer, offset: operation * alignment, size: 16 } : { buffer } })) });
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(Math.ceil(count / 32)); pass.end();
  };
  return { encode(encoder) { validate(); dispatch(encoder, 0); operations.forEach((_, i) => dispatch(encoder, 1, i)); dispatch(encoder, 2); } };
}
