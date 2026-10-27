import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';

// The existing solver supplies discrete binary32 velocity, specific internal
// energy and deformation increments. Apply those increments to the retained
// extensive records. In particular, kinetic energy uses the carried momentum,
// not a new mass-times-rounded-velocity seed.
export function sphExactG2pQuantityProgram() {
  const operations = [];
  let count = 20;
  const op = (kind, left, right) => {
    const out = count++;
    operations.push(Object.freeze({ kind, left, right, out }));
    return out;
  };
  const add = (a, b) => op(0, a, b), sub = (a, b) => op(1, a, b);
  const mul = (a, b) => op(2, a, b), div = (a, b) => op(3, a, b);
  const momentum = [0, 1, 2].map(axis => add(1 + axis, mul(0, sub(12 + axis, 8 + axis))));
  const twiceMass = add(0, 0);
  const kinetic = values => div(values.map(p => mul(p, p)).reduce(add), twiceMass);
  const oldKinetic = kinetic([1, 2, 3]), newKinetic = kinetic(momentum);
  const energy = add(add(4, mul(0, sub(15, 11))), sub(newKinetic, oldKinetic));
  const restRatio = div(19, 18);
  const rest = mul(5, restRatio), volume = mul(mul(6, div(17, 16)), restRatio);
  const projections = [...momentum.map(p => div(p, 0)), div(sub(energy, newKinetic), 0), rest, div(volume, rest)];
  return Object.freeze({ operations: Object.freeze(operations), registerCount: count,
    fields: Object.freeze([...momentum, energy, rest, volume, 7]), projections: Object.freeze(projections) });
}

export function createSphExactG2pQuantityWgsl(format, layout, program = sphExactG2pQuantityProgram(), operationKind = null) {
  if (operationKind !== null && ![0, 1, 2, 3].includes(operationKind)) {
    throw new RangeError('Unknown exact G2P arithmetic operation');
  }
  const stride = layout.recordWords, scalar = layout.scalar.recordWords, registers = program.registerCount;
  return createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount }) + /* wgsl */ `
@group(0) @binding(0) var<storage, read> gq_source: array<u32>;
@group(0) @binding(1) var<storage, read> gq_old_state: array<u32>;
@group(0) @binding(2) var<storage, read> gq_old_mechanics: array<u32>;
@group(0) @binding(3) var<storage, read_write> gq_state: array<u32>;
@group(0) @binding(4) var<storage, read_write> gq_mechanics: array<u32>;
@group(0) @binding(5) var<storage, read_write> gq_output: array<u32>;
@group(0) @binding(6) var<storage, read_write> gq_scratch: array<u32>;
@group(0) @binding(7) var<storage, read_write> gq_validation: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> gq_params: vec4<u32>;
@group(0) @binding(9) var<uniform> gq_operation: vec4<u32>;
@group(0) @binding(10) var<storage, read_write> gq_projection: array<u32>;
fn gq_active(row: u32) -> bool {
  var mass = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) { mass |= gq_source[row * ${stride}u + ${layout.massOffsetWords}u + i]; }
  return mass != 0u;
}

fn gq_register(row: u32, slot: u32) -> u32 { return (row * ${registers}u + slot) * ${scalar}u; }
fn gq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = gq_register(row, slot);
  (*v).negative = gq_scratch[at]; (*v).error = gq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(gq_scratch[at + 2u]); (*v).reserved = gq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) {
    (*v).numerator[i] = gq_scratch[at + 4u + i];
    (*v).denominator[i] = gq_scratch[at + 4u + XR_WORDS + i];
  }
}
fn gq_store(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = gq_register(row, slot);
  gq_scratch[at] = (*v).negative; gq_scratch[at + 1u] = (*v).error;
  gq_scratch[at + 2u] = bitcast<u32>((*v).exponent); gq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) {
    gq_scratch[at + 4u + i] = (*v).numerator[i];
    gq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i];
  }
  if ((*v).error != 0u) { atomicOr(&gq_validation[0u], (*v).error); }
}
fn gq_ingress(row: u32, slot: u32, bits: u32) {
  let at = gq_register(row, slot); let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { atomicOr(&gq_validation[0u], 1u); return; }
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  if (coefficient == 0u) { return; }
  let shift = countTrailingZeros(coefficient);
  gq_scratch[at] = bits >> 31u;
  gq_scratch[at + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  gq_scratch[at + 4u] = coefficient >> shift;
}
@compute @workgroup_size(32)
fn prepare_exact_g2p_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= gq_params.x) { return; }
  let base = row * ${stride}u;
  for (var i = 0u; i < ${stride}u; i++) { gq_output[base + i] = gq_source[base + i]; }
  let scratch = gq_register(row, 0u);
  for (var i = 0u; i < ${registers * scalar}u; i++) { gq_scratch[scratch + i] = 0u; }
  for (var slot = 0u; slot < ${registers}u; slot++) { gq_scratch[gq_register(row, slot) + 4u + XR_WORDS] = 1u; }
  if (!gq_active(row)) { return; }
  if (gq_source[base] != 1u || gq_source[base + 1u] != 0u
      || gq_old_state[row * 8u + 3u] != gq_state[row * 8u + 3u]
      || gq_old_mechanics[row * 32u + 31u] != gq_mechanics[row * 32u + 31u]) {
    atomicOr(&gq_validation[0u], 1u); return;
  }
  gq_scratch[scratch + 2u] = bitcast<u32>(${format.quantumExponent}i);
  for (var i = 0u; i < ${format.wordCount}u; i++) { gq_scratch[scratch + 4u + i] = gq_source[base + ${layout.massOffsetWords}u + i]; }
  for (var field = 0u; field < 7u; field++) {
    if (gq_source[base + ${layout.scalarOffsetWords}u + field * ${scalar}u + 1u] != 0u) { atomicOr(&gq_validation[0u], 1u); }
    for (var i = 0u; i < ${scalar}u; i++) {
      gq_scratch[gq_register(row, field + 1u) + i] = gq_source[base + ${layout.scalarOffsetWords}u + field * ${scalar}u + i];
    }
  }
  for (var axis = 0u; axis < 4u; axis++) {
    gq_projection[row * 12u + 6u + axis] = gq_state[row * 8u + 4u + axis];
    gq_ingress(row, 8u + axis, gq_old_state[row * 8u + 4u + axis]);
    gq_ingress(row, 12u + axis, gq_state[row * 8u + 4u + axis]);
  }
  gq_ingress(row, 16u, gq_old_mechanics[row * 32u + 18u]);
  gq_ingress(row, 17u, gq_mechanics[row * 32u + 18u]);
  gq_ingress(row, 18u, gq_old_mechanics[row * 32u + 19u]);
  gq_ingress(row, 19u, gq_mechanics[row * 32u + 19u]);
  gq_projection[row * 12u + 10u] = gq_mechanics[row * 32u + 19u];
  gq_projection[row * 12u + 11u] = gq_mechanics[row * 32u + 18u];
}
@compute @workgroup_size(32)
fn execute_exact_g2p_quantity_op(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= gq_params.x || !gq_active(row)) { return; }
  var a: ExactRational; var b: ExactRational; var v: ExactRational;
  gq_load(row, gq_operation.y, &a); gq_load(row, gq_operation.z, &b);
  ${operationKind === null ? `switch gq_operation.x {
    case 0u: { xrp_rational_add(&v, &a, &b); }
    case 1u: { xrp_rational_subtract(&v, &a, &b); }
    case 2u: { xrp_rational_multiply(&v, &a, &b); }
    case 3u: { xrp_rational_divide(&v, &a, &b); }
    default: { v.error = 1u; }
  }` : `if (gq_operation.x != ${operationKind}u) { v.error = 1u; }
  else { xrp_rational_${['add', 'subtract', 'multiply', 'divide'][operationKind]}(&v, &a, &b); }`}
  gq_store(row, gq_operation.w, &v);
}
@compute @workgroup_size(32)
fn project_exact_g2p_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 6u; let field = id.x % 6u;
  if (row >= gq_params.x || !gq_active(row)) { return; }
  let slots = array<u32, 6>(${program.projections.map(n => `${n}u`).join(', ')});
  var value: ExactRational; gq_load(row, slots[field], &value);
  let projection = xrp_project_f32_bits(&value);
  if (projection.error != 0u || (projection.bits & 0x7fffffffu) >= 0x7f800000u
      || (field >= 4u && (projection.bits == 0u || projection.bits >= 0x7f800000u))) {
    atomicOr(&gq_validation[0u], 1u);
  }
  gq_projection[row * 12u + field] = projection.bits;
}
@compute @workgroup_size(32)
fn apply_exact_g2p_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= gq_params.x || !gq_active(row) || atomicLoad(&gq_validation[0u]) != 0u) { return; }
  let old_j = bitcast<f32>(gq_mechanics[row * 32u + 18u]);
  let next_j = bitcast<f32>(gq_projection[row * 12u + 5u]);
  let scale = pow(next_j / old_j, 1.0 / 3.0);
  if (!(scale > 0.0) || scale > 3.402823e38) { atomicOr(&gq_validation[0u], 1u); return; }
  let slots = array<u32, 7>(${program.fields.map(n => `${n}u`).join(', ')});
  for (var field = 0u; field < 7u; field++) {
    for (var i = 0u; i < ${scalar}u; i++) {
      gq_output[row * ${stride}u + ${layout.scalarOffsetWords}u + field * ${scalar}u + i] = gq_scratch[gq_register(row, slots[field]) + i];
    }
  }
  for (var axis = 0u; axis < 4u; axis++) { gq_state[row * 8u + 4u + axis] = gq_projection[row * 12u + axis]; }
  // The mechanics ABI packs F as nine consecutive scalars. C starts at
  // word 9; treating F as padded vec3 rows corrupts C and skips F10/F21.
  for (var component = 0u; component < 9u; component++) {
    let at = row * 32u + component;
    let next = bitcast<f32>(gq_mechanics[at]) * scale;
    if (!(abs(next) <= 3.402823e38)) { atomicOr(&gq_validation[0u], 1u); }
    gq_mechanics[at] = bitcast<u32>(next);
  }
  gq_mechanics[row * 32u + 19u] = gq_projection[row * 12u + 4u];
  gq_mechanics[row * 32u + 18u] = gq_projection[row * 12u + 5u];
}
`;
}

// The same original authority predicates that retire the physical candidate
// also retire its quantities. No second acceptance decision can publish one
// half of a rejected tuple.
export function appendSphExactG2pFinalizerWgsl(code, layout, canonical, history = false) {
  return code + /* wgsl */ `
@group(0) @binding(9) var<storage, read> exact_g2p_validation: array<u32>;
@group(0) @binding(10) var<storage, read> exact_g2p_original: array<u32>;
@group(0) @binding(11) var<storage, read_write> exact_g2p_quantities: array<u32>;
${history ? '@group(0) @binding(12) var<storage,read_write> exact_g2p_history_validation:array<atomic<u32>>;' : ''}
@compute @workgroup_size(64)
fn finalize_exact_g2p_authority(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count) { return; }
  if (exact_g2p_validation[0u] != 0u ${history ? '|| atomicLoad(&exact_g2p_history_validation[0u]) != 0u' : ''} ${canonical ? '|| g2p_p2g_authority_rejected() || g2p_spatial_authority_rejected()' : ''}) {
    ${history ? 'atomicOr(&exact_g2p_history_validation[0u], 128u);' : ''}
    ${canonical ? 'g2p_copy_input_particle(row * 2u, row * 8u);' : `
    out_sph_state[row * 2u] = sph_state[row * 2u];
    out_sph_state[row * 2u + 1u] = sph_state[row * 2u + 1u];
    for (var i = 0u; i < 8u; i++) { out_mls_mechanics[row * 8u + i] = mls_mechanics[row * 8u + i]; }`}
    for (var i = 0u; i < ${layout.recordWords}u; i++) {
      exact_g2p_quantities[row * ${layout.recordWords}u + i] = exact_g2p_original[row * ${layout.recordWords}u + i];
    }
  }
}
`;
}
