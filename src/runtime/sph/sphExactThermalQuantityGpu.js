import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

// The genuine thermal producer owns submission, captures and retirement. Its
// admitted du is recorded before adding it to the rounded specific-energy view.
export async function prepareSphExactThermalQuantities({ device, capture }) {
  capture.validate();
  const { quantityBuffer: original, quantityLayout: layout, format } = capture.quantities;
  const count = capture.particleCount, stride = layout.recordWords, scalar = layout.scalar.recordWords;
  const operations = []; let registers = 7;
  const op = (kind, a, b) => { const out = registers++; operations.push([kind, a, b, out]); return out; };
  const add = (a, b) => op(0, a, b), sub = (a, b) => op(1, a, b), mul = (a, b) => op(2, a, b), div = (a, b) => op(3, a, b);
  // Registers: M, Px, Py, Pz, E, admitted du, clamped specific-energy target.
  const kinetic = div([1, 2, 3].map(p => mul(p, p)).reduce(add), add(0, 0));
  const energy = add(4, mul(0, 5)), boundedEnergy = add(kinetic, mul(0, 6));
  const internal = div(sub(energy, kinetic), 0);
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const bytes = count * stride * 4, scratchBytes = count * registers * scalar * 4;
  if (layout.rowCount !== count || bytes !== original.size
      || !Number.isSafeInteger(scratchBytes) || Math.max(bytes, scratchBytes) > device.limits.maxStorageBufferBindingSize
      || Math.max(bytes, scratchBytes, operations.length * alignment) > device.limits.maxBufferSize
      || device.limits.maxStorageBuffersPerShaderStage < 12
      || Math.ceil(count / 32) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact thermal quantities exceed the original carrier/device capacity');
  }
  const outputs = [], transient = [];
  const allocate = (name, size, usage, list) => {
    const buffer = tagWebGpuBufferDevice(device.createBuffer({ label: `ulg-exact-thermal-${name}`, size, usage }), device);
    list.push(buffer); return buffer;
  };
  const destroy = list => { for (const buffer of list.splice(0)) buffer.destroy(); };
  try {
    const quantityBuffer = allocate('quantities', bytes, 128 | 4 | 8, outputs);
    const updates = allocate('updates', count * 32, 128 | 4 | 8, outputs);
    const validationBuffer = allocate('validation', 16, 128 | 4 | 8, outputs);
    const scratch = allocate('scratch', scratchBytes, 128 | 8, transient);
    const params = allocate('params', 16, 64 | 8, transient);
    const instructions = allocate('instructions', operations.length * alignment, 64 | 8, transient);
    markSphExactMassDerivedBuffers(capture.sourceRead, [quantityBuffer]);
    const words = new Uint32Array(instructions.size / 4);
    operations.forEach((instruction, i) => words.set(instruction, i * alignment / 4));
    device.queue.writeBuffer(instructions, 0, words);
    device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
    const createCode = (operationKind = 0) => createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount }) + /* wgsl */ `
@group(0) @binding(0) var<storage, read> tq_source: array<u32>;
@group(0) @binding(1) var<storage, read_write> tq_output: array<u32>;
@group(0) @binding(2) var<storage, read_write> tq_scratch: array<u32>;
@group(0) @binding(3) var<storage, read_write> tq_updates: array<u32>;
@group(0) @binding(4) var<storage, read_write> tq_validation: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> tq_params: vec4<u32>;
@group(0) @binding(6) var<uniform> tq_op: vec4<u32>;
fn tq_active(row: u32) -> bool {
  var mass = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass |= tq_source[row * ${stride}u + ${layout.massOffsetWords}u + i]; }
  return mass != 0u;
}
fn tq_at(row: u32, slot: u32) -> u32 { return (row * ${registers}u + slot) * ${scalar}u; }
fn tq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = tq_at(row, slot);
  (*v).negative = tq_scratch[at]; (*v).error = tq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(tq_scratch[at + 2u]); (*v).reserved = tq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = tq_scratch[at + 4u + i]; (*v).denominator[i] = tq_scratch[at + 4u + XR_WORDS + i]; }
}
fn tq_ingress(row: u32, slot: u32, bits: u32) {
  let at = tq_at(row, slot); let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { atomicOr(&tq_validation[0u], 1u); return; }
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  if (coefficient == 0u) { return; }
  let shift = countTrailingZeros(coefficient); tq_scratch[at] = bits >> 31u;
  tq_scratch[at + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  tq_scratch[at + 4u] = coefficient >> shift;
}
@compute @workgroup_size(32)
fn prepare_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= tq_params.x) { return; }
  let base = row * ${stride}u;
  for (var i = 0u; i < ${stride}u; i++) { tq_output[base + i] = tq_source[base + i]; }
  for (var i = 0u; i < ${registers * scalar}u; i++) { tq_scratch[tq_at(row, 0u) + i] = 0u; }
  for (var slot = 0u; slot < ${registers}u; slot++) { tq_scratch[tq_at(row, slot) + 4u + XR_WORDS] = 1u; }
  if (!tq_active(row)) { return; }
  if (tq_source[base] != 1u || tq_source[base + 1u] != 0u || tq_updates[row * 8u] > 2u) { atomicOr(&tq_validation[0u], 1u); }
  tq_scratch[tq_at(row, 0u) + 2u] = bitcast<u32>(${format.quantumExponent}i);
  for (var i = 0u; i < ${format.wordCount}u; i++) { tq_scratch[tq_at(row, 0u) + 4u + i] = tq_source[base + ${layout.massOffsetWords}u + i]; }
  for (var field = 0u; field < 4u; field++) {
    if (tq_source[base + ${layout.scalarOffsetWords}u + field * ${scalar}u + 1u] != 0u) { atomicOr(&tq_validation[0u], 1u); }
    for (var i = 0u; i < ${scalar}u; i++) { tq_scratch[tq_at(row, field + 1u) + i] = tq_source[base + ${layout.scalarOffsetWords}u + field * ${scalar}u + i]; }
  }
  tq_ingress(row, 5u, tq_updates[row * 8u + 1u]); tq_ingress(row, 6u, tq_updates[row * 8u + 2u]);
}
@compute @workgroup_size(32)
fn execute_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= tq_params.x || !tq_active(row)) { return; }
  var a: ExactRational; var b: ExactRational; var v: ExactRational;
  tq_load(row, tq_op.y, &a); tq_load(row, tq_op.z, &b);
  if (tq_op.x != ${operationKind}u) { v.error = 1u; }
  else { xrp_rational_${['add', 'subtract', 'multiply', 'divide'][operationKind]}(&v, &a, &b); }
  let at = tq_at(row, tq_op.w); tq_scratch[at] = v.negative; tq_scratch[at + 1u] = v.error;
  tq_scratch[at + 2u] = bitcast<u32>(v.exponent); tq_scratch[at + 3u] = v.reserved;
  for (var i = 0u; i < XR_WORDS; i++) { tq_scratch[at + 4u + i] = v.numerator[i]; tq_scratch[at + 4u + XR_WORDS + i] = v.denominator[i]; }
  if (v.error != 0u) { atomicOr(&tq_validation[0u], v.error); }
}
@compute @workgroup_size(32)
fn project_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= tq_params.x || !tq_active(row)) { return; }
  var v: ExactRational; tq_load(row, select(${internal}u, 6u, tq_updates[row * 8u] == 2u), &v);
  let projection = xrp_project_f32_bits(&v);
  if (projection.error != 0u || (projection.bits & 0x7fffffffu) >= 0x7f800000u) { atomicOr(&tq_validation[0u], 1u); }
  tq_updates[row * 8u + 3u] = projection.bits;
}
@compute @workgroup_size(32)
fn commit_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= tq_params.x || !tq_active(row) || atomicLoad(&tq_validation[0u]) != 0u) { return; }
  let source = tq_at(row, select(${energy}u, ${boundedEnergy}u, tq_updates[row * 8u] == 2u));
  tq_output[row * ${stride}u + 3u] = tq_updates[row * 8u + 4u];
  let destination = row * ${stride}u + ${layout.scalarOffsetWords + 3 * scalar}u;
  for (var i = 0u; i < ${scalar}u; i++) { tq_output[destination + i] = tq_scratch[source + i]; }
}
`;
    const pipelines = new Map();
    const descriptors = [
      { key: 'prepare', entryPoint: 'prepare_exact_thermal' },
      ...['add', 'subtract', 'multiply', 'divide'].map((name, kind) => ({ key: kind, kind,
        entryPoint: 'execute_exact_thermal', label: `execute_exact_thermal_${name}` })),
      { key: 'project', entryPoint: 'project_exact_thermal' },
      { key: 'commit', entryPoint: 'commit_exact_thermal' }
    ];
    // Keep each wide arithmetic call graph in its own pipeline, as in G2P.
    for (const { key, entryPoint, label = entryPoint, kind = 0 } of descriptors) {
      const pipeline = await prewarmCachedExplicitComputePipeline(device, { code: createCode(kind), entryPoint,
        cacheKey: `${label}-v2-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}`, label: `ulg-${label}`,
        bindings: ['read-only-storage', 'storage', 'storage', 'storage', 'storage', 'uniform', 'uniform'].map((type, binding) => computeBufferBinding(binding, type)) });
      if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact thermal pipeline unavailable: ${entryPoint}`);
      capture.validate(); pipelines.set(key, pipeline);
    }
    const resources = [original, quantityBuffer, scratch, updates, validationBuffer, params, instructions];
    const dispatch = (encoder, key, offset = 0) => {
      const pipeline = pipelines.get(key);
      const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
        entries: resources.map((buffer, binding) => ({ binding, resource: binding === 6 ? { buffer, offset, size: 16 } : { buffer } })) });
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.ceil(count / 32)); pass.end();
    };
    return { quantityBuffer, quantityLayout: layout, format, updates, validationBuffer,
      clear(encoder) { encoder.clearBuffer(updates); encoder.clearBuffer(validationBuffer); },
      encode(encoder) { capture.validate(); dispatch(encoder, 'prepare'); operations.forEach(([kind], i) => dispatch(encoder, kind, i * alignment)); dispatch(encoder, 'project'); },
      commit(encoder) { dispatch(encoder, 'commit'); },
      cleanupTransient() { destroy(transient); }, destroyOutput() { destroy(outputs); },
      abandon() { destroy(transient); destroy(outputs); },
      encodedDispatchCount: operations.length + 3
    };
  } catch (error) { destroy(transient); destroy(outputs); throw error; }
}

export function appendSphExactThermalQuantityWgsl(code) {
  const marker = '  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);';
  if (!code.includes(marker)) throw new Error('Thermal energy apply changed; review the exact increment capture');
  return code.replace(marker, /* wgsl */ `
  let domain_ready = select(carrier_domain_ready, canonical_reachable_domain_ready, params.canonical_proposal_enabled == 1u);
  if (domain_ready && thermal_value_finite(du) && thermal_value_finite(candidate_next_u)) {
    tq_update[particle_index * 8u] = select(2u, 1u, next_u == candidate_next_u);
    tq_update[particle_index * 8u + 1u] = bitcast<u32>(du);
    tq_update[particle_index * 8u + 2u] = bitcast<u32>(next_u);
  }
${marker}`) + /* wgsl */ `
@group(0) @binding(11) var<storage, read_write> tq_update: array<u32>;
@group(0) @binding(12) var<storage, read_write> tq_status: array<atomic<u32>>;
@compute @workgroup_size(64)
fn finalize_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || !(state_pos_mass(row).w > 0.0) || atomicLoad(&tq_status[0u]) != 0u) { return; }
  let u = bitcast<f32>(tq_update[row * 8u + 3u]);
  let v = state_vel_u(row);
  out_sph_state[row * 2u + 1u] = vec4<f32>(v.xyz, u);
  write_thermal_state(row, thermo_row0(row).x, u, thermo_row1(row), thermo_row2(row));
  tq_update[row * 8u + 4u] = u32(out_sph_thermo[row * 3u].y);
  if (out_sph_thermo[row * 3u + 2u].z != 1.0) { atomicOr(&tq_status[0u], 1u); }
}
@compute @workgroup_size(64)
fn restore_rejected_exact_thermal(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&tq_status[0u]) == 0u) { return; }
  out_sph_state[row * 2u] = state_pos_mass(row); out_sph_state[row * 2u + 1u] = state_vel_u(row);
  out_sph_thermo[row * 3u] = thermo_row0(row); out_sph_thermo[row * 3u + 1u] = thermo_row1(row); out_sph_thermo[row * 3u + 2u] = thermo_row2(row);
}
`;
}
