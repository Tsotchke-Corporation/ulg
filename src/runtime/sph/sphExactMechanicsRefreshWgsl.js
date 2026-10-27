import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { mlsMpmMechanicsRefreshWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { SPH_EXACT_MASS_ERROR } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

// The constitutive refresh changes reference volume, not mass, momentum,
// energy, current volume or phase-reference mass. Its physical views must be
// projections of those quantities, rather than seeds for a replacement ledger.
export function createSphExactMechanicsQuantityRefreshWgsl(format, layout) {
  const stride = layout.recordWords, scalar = layout.scalar.recordWords;
  // The separate operand pass normalizes external mass/current volume. The
  // reference pass constructs a canonical rational directly; division keeps
  // its checked result reduction. Avoid nesting three wide reductions in one
  // invocation of the full resident workload.
  return createSphExactRationalQuantityWgsl({ wordCount: layout.scalar.wordCount, canonicalOperands: true }) + /* wgsl */ `
@group(0) @binding(0) var<storage, read> eq_source: array<u32>;
@group(0) @binding(1) var<storage, read> eq_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> eq_output: array<u32>;
@group(0) @binding(3) var<storage, read_write> eq_projection: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> eq_validation: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> eq_params: vec4<u32>;
@group(0) @binding(6) var<storage, read_write> eq_scratch: array<u32>;
fn eq_active(row: u32) -> bool {
  var nonzero = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    nonzero |= eq_source[row * ${stride}u + ${layout.massOffsetWords}u + i];
  }
  return nonzero != 0u;
}
fn eq_store(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = (row * 5u + slot) * ${scalar}u;
  eq_scratch[at] = (*v).negative; eq_scratch[at + 1u] = (*v).error;
  eq_scratch[at + 2u] = bitcast<u32>((*v).exponent); eq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) {
    eq_scratch[at + 4u + i] = (*v).numerator[i];
    eq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i];
  }
}
fn eq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = (row * 5u + slot) * ${scalar}u;
  (*v).negative = eq_scratch[at]; (*v).error = eq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(eq_scratch[at + 2u]); (*v).reserved = eq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) {
    (*v).numerator[i] = eq_scratch[at + 4u + i];
    (*v).denominator[i] = eq_scratch[at + 4u + XR_WORDS + i];
  }
}
fn eq_load_scalar(row: u32, field: u32) -> ExactRational {
  let at = row * ${stride}u + ${layout.scalarOffsetWords}u + field * ${scalar}u;
  var v: ExactRational;
  v.negative = eq_source[at]; v.error = eq_source[at + 1u];
  v.exponent = bitcast<i32>(eq_source[at + 2u]); v.reserved = eq_source[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) {
    v.numerator[i] = eq_source[at + 4u + i];
    v.denominator[i] = eq_source[at + 4u + XR_WORDS + i];
  }
  return v;
}
@compute @workgroup_size(32)
fn prepare_exact_mechanics_refresh(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= eq_params.x) { return; }
  let at = row * ${stride}u;
  for (var i = 0u; i < 4u; i++) { atomicStore(&eq_projection[row * 4u + i], 0u); }
  let scratch = row * 5u * ${scalar}u;
  for (var i = 0u; i < 5u * ${scalar}u; i++) { eq_scratch[scratch + i] = 0u; }
  for (var slot = 0u; slot < 5u; slot++) { eq_scratch[scratch + slot * ${scalar}u + 4u + XR_WORDS] = 1u; }
  if (!eq_active(row)) { return; }
  eq_scratch[scratch + 2u] = bitcast<u32>(${format.quantumExponent}i);
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    eq_scratch[scratch + 4u + i] = eq_source[at + ${layout.massOffsetWords}u + i];
  }
  let bits = bitcast<u32>(eq_thermo[row * 3u].w);
  if (eq_source[at] != 1u || eq_source[at + 1u] != 0u
      || bits == 0u || bits >= 0x7f800000u) {
    atomicAdd(&eq_validation[0u], 1u); return;
  }
  // Positive finite f32 density has a power-of-two denominator. Its canonical
  // rational encoding needs only integer bit extraction, no wide division.
  let encoded = (bits >> 23u) & 255u;
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  let shift = countTrailingZeros(coefficient);
  eq_scratch[scratch + ${scalar}u + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  eq_scratch[scratch + ${scalar}u + 4u] = coefficient >> shift;
  for (var i = 0u; i < ${scalar}u; i++) {
    eq_scratch[scratch + 3u * ${scalar}u + i] = eq_source[at + ${layout.scalarOffsetWords + 5 * scalar}u + i];
  }
}
@compute @workgroup_size(32)
fn divide_exact_mechanics_reference(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= eq_params.x || !eq_active(row)) { return; }
  let scratch = row * 5u * ${scalar}u;
  let out = scratch + 2u * ${scalar}u;
  // Preparation decoded density as an odd coefficient c <= 2^24-1 times
  // 2^e. Canonicalize M/c directly in storage. Both bitwise remainder loops
  // stay below 2*c <= 2^25-2, so every operation fits an ordinary u32.
  // This preserves every mass limb without a wide private rational temporary.
  let density_coefficient = eq_scratch[scratch + ${scalar}u + 4u];
  if (density_coefficient == 0u) {
    eq_scratch[out + 1u] = ${SPH_EXACT_MASS_ERROR.DIVISION_BY_ZERO}u; return;
  }
  var trailing = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    let word = eq_scratch[scratch + 4u + i];
    if (word != 0u) { trailing = i * 32u + countTrailingZeros(word); break; }
  }
  let base_exponent = xr_exponent_subtract(${format.quantumExponent}i,
    bitcast<i32>(eq_scratch[scratch + ${scalar}u + 2u]));
  let exponent = xr_exponent_add(base_exponent.value, i32(trailing));
  if ((base_exponent.error | exponent.error) != 0u) {
    eq_scratch[out + 1u] = base_exponent.error | exponent.error; return;
  }
  eq_scratch[out + 2u] = bitcast<u32>(exponent.value);
  let whole = trailing / 32u; let within = trailing % 32u;
  for (var i = 0u; i < ${format.wordCount}u; i++) {
    let source_word = i + whole; var word = 0u;
    if (source_word < ${format.wordCount}u) {
      word = eq_scratch[scratch + 4u + source_word] >> within;
      if (within != 0u && source_word + 1u < ${format.wordCount}u) {
        word |= eq_scratch[scratch + 5u + source_word] << (32u - within);
      }
    }
    eq_scratch[out + 4u + i] = word;
  }
  var remainder = 0u;
  for (var i = ${format.wordCount}u; i > 0u; i--) {
    let word = eq_scratch[out + 3u + i];
    for (var bit = 32u; bit > 0u; bit--) {
      remainder = (remainder << 1u) | ((word >> (bit - 1u)) & 1u);
      if (remainder >= density_coefficient) { remainder -= density_coefficient; }
    }
  }
  var divisor = density_coefficient; var other = remainder;
  while (other != 0u) { let next = divisor % other; divisor = other; other = next; }
  eq_scratch[out + 4u + XR_WORDS] = density_coefficient / divisor;
  // Divide the already odd numerator by its common odd factor. Reading and
  // writing from the most significant word down is safe in this private row.
  remainder = 0u;
  for (var i = ${format.wordCount}u; i > 0u; i--) {
    let word = eq_scratch[out + 3u + i]; var quotient = 0u;
    for (var bit = 32u; bit > 0u; bit--) {
      remainder = (remainder << 1u) | ((word >> (bit - 1u)) & 1u);
      let digit = select(0u, 1u, remainder >= divisor);
      remainder -= digit * divisor; quotient = (quotient << 1u) | digit;
    }
    eq_scratch[out + 3u + i] = quotient;
  }
}
@compute @workgroup_size(32)
fn normalize_exact_mechanics_operands(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 2u; let slot = (id.x % 2u) * 3u;
  if (row >= eq_params.x || !eq_active(row)) { return; }
  var source: ExactRational; var canonical: ExactRational;
  eq_load(row, slot, &source); xrp_normalize(&canonical, &source);
  eq_store(row, slot, &canonical);
}
@compute @workgroup_size(32)
fn divide_exact_mechanics_ratio(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= eq_params.x || !eq_active(id.x)) { return; }
  var left: ExactRational; var right: ExactRational; var result: ExactRational;
  eq_load(id.x, 3u, &left); eq_load(id.x, 2u, &right);
  xrp_rational_divide(&result, &left, &right); eq_store(id.x, 4u, &result);
}
@compute @workgroup_size(32)
fn project_exact_mechanics_scalar(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 3u; let field = id.x % 3u;
  if (row >= eq_params.x || !eq_active(row)) { return; }
  var value: ExactRational; eq_load(row, field * 2u, &value);
  let projection = xrp_project_f32_bits(&value);
  atomicStore(&eq_projection[row * 4u + field], projection.bits);
  if (projection.error != 0u || projection.bits == 0u || projection.bits >= 0x7f800000u) {
    atomicOr(&eq_projection[row * 4u + 3u], 2u);
    atomicAdd(&eq_validation[0u], 1u);
  }
}
@compute @workgroup_size(32)
fn finalize_exact_mechanics_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= eq_params.x || !eq_active(row)) { return; }
  let rest = (row * 5u + 2u) * ${scalar}u;
  if (eq_scratch[rest + 1u] != 0u || atomicLoad(&eq_projection[row * 4u + 3u]) != 0u) {
    atomicAdd(&eq_validation[0u], 1u); return;
  }
  let out = row * ${stride}u + ${layout.scalarOffsetWords + 4 * scalar}u;
  for (var i = 0u; i < ${scalar}u; i++) { eq_output[out + i] = eq_scratch[rest + i]; }
  atomicStore(&eq_projection[row * 4u + 3u], 1u);
}
@compute @workgroup_size(64)
fn commit_or_restore_exact_mechanics_quantities(@builtin(global_invocation_id) id: vec3<u32>,
    @builtin(num_workgroups) groups: vec3<u32>) {
  let word = id.x + id.y * groups.x * 64u;
  if (atomicLoad(&eq_validation[0u]) == 0u || word >= eq_params.x * ${stride}u) { return; }
  eq_output[word] = eq_source[word];
}
`;
}

export function createSphExactMechanicsRefreshWgsl() {
  let code = mlsMpmMechanicsRefreshWgsl;
  const replace = (from, to) => {
    if (!code.includes(from) || code.indexOf(from) !== code.lastIndexOf(from)) {
      throw new Error('Original mechanics refresh changed its exact quantity integration point');
    }
    code = code.replace(from, to);
  };
  replace('fn material_bank_warm_input_anchor()',
    '@group(0) @binding(8) var<storage, read> exact_refresh_projection: array<vec4<u32>>;\n\nfn material_bank_warm_input_anchor()');
  replace('var rest_volume = state0.w / rest_density;', `let exact = exact_refresh_projection[particle_index];
  if (exact.w != 1u || bitcast<u32>(state0.w) != exact.x) {
    mechanics_refresh_fail(); return;
  }
  var rest_volume = bitcast<f32>(exact.y);`);
  replace('let next_volume_ratio_j = current_volume / rest_volume;',
    'let next_volume_ratio_j = bitcast<f32>(exact.z);');
  return code;
}
