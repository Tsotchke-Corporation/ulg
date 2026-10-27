import { createSphExactMassWgsl } from './sphExactMassWgsl.js';

// Numerical mass plane for the four physical phase lanes of each lineage.
// Thermal fractions select integer packets in the run's mass lattice. Cumulative
// allocation gives every source's final low bit to a destination; no mass is
// reconstructed from the renderer's f32 projection. This kernel alone grants
// no particle/phase authority: its producer must also publish matched momentum,
// total energy, caloric state, mechanics and the unchanged row identity.
export function createSphExactPhaseCarrierMassWgsl(format) {
  return createSphExactMassWgsl(format) + /* wgsl */ `
const PC_LAYOUT: u32 = 0x01000000u;
const PC_FRACTION: u32 = 0x02000000u;
const PC_MATERIAL: u32 = 0x04000000u;
const PC_RATIO_CAPACITY: u32 = 0x08000000u;
const PC_CONSERVATION: u32 = 0x10000000u;
@group(0) @binding(0) var<storage, read> pc_mass: array<u32>;
@group(0) @binding(1) var<storage, read> pc_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pc_packets: array<u32>;
@group(0) @binding(3) var<storage, read_write> pc_sum: array<u32>;
@group(0) @binding(4) var<storage, read_write> pc_output: array<u32>;
@group(0) @binding(5) var<storage, read_write> pc_control: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> pc_shape: vec4<u32>;

fn pc_valid_layout() -> bool {
  let rows = pc_shape.x * 4u;
  return pc_shape.x > 0u && rows / 4u == pc_shape.x && pc_shape.y == rows
    && pc_shape.z == 0u && pc_shape.w == 0u
    && arrayLength(&pc_control) == 4u
    && arrayLength(&pc_mass) == rows * EM_WORDS
    && arrayLength(&pc_thermo) == rows * 3u
    && arrayLength(&pc_packets) == rows * 4u * EM_WORDS
    && arrayLength(&pc_sum) == rows * EM_WORDS
    && arrayLength(&pc_output) == rows * EM_WORDS;
}
fn pc_load_mass(row: u32) -> ExactMass {
  var mass: ExactMass;
  for (var limb = 0u; limb < EM_WORDS; limb++) { mass.words[limb] = pc_mass[row * EM_WORDS + limb]; }
  return mass;
}
fn pc_fraction_exponent(bits: u32) -> i32 {
  let encoded = (bits >> 23u) & 255u;
  return select(-149, i32(encoded) - 150, encoded != 0u);
}
fn pc_fraction_weight(bits: u32, common_exponent: i32) -> ExactMassResult {
  var weight = ExactMass();
  if ((bits & 0x7fffffffu) == 0u) { return ExactMassResult(weight, 0u); }
  let encoded = (bits >> 23u) & 255u;
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  let shift = pc_fraction_exponent(bits) - common_exponent;
  if (shift < 0 || shift + 31 - i32(countLeadingZeros(coefficient)) >= i32(EM_WORDS * 32u)) {
    return ExactMassResult(weight, PC_RATIO_CAPACITY);
  }
  let word = u32(shift) / 32u; let within = u32(shift) % 32u;
  weight.words[word] = coefficient << within;
  if (within != 0u && word + 1u < EM_WORDS) { weight.words[word + 1u] = coefficient >> (32u - within); }
  return ExactMassResult(weight, 0u);
}

@compute @workgroup_size(32)
fn select_phase_packets(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.x) { return; }
  if (!pc_valid_layout()) { atomicOr(&pc_control[0], PC_LAYOUT); return; }
  var lineage_material = 0.0;
  for (var source_lane = 0u; source_lane < 4u; source_lane++) {
    let row = source_lane * pc_shape.x + id.x;
    for (var i = 0u; i < 4u * EM_WORDS; i++) { pc_packets[row * 4u * EM_WORDS + i] = 0u; }
    let mass = pc_load_mass(row);
    if (em_zero(mass)) { continue; }
    atomicAdd(&pc_control[1], 1u);
    let material = pc_thermo[row * 3u].x;
    if (!(material >= 1.0 && material <= 16777215.0) || material != floor(material)
        || (lineage_material != 0.0 && lineage_material != material)) {
      atomicOr(&pc_control[0], PC_MATERIAL); continue;
    }
    lineage_material = material;
    let fractions = pc_thermo[row * 3u + 1u];
    var positive = 0u; var first_phase = 0u; var last_phase = 0u;
    var common_exponent = 0; var sum = 0.0; var invalid = false;
    for (var phase = 0u; phase < 4u; phase++) {
      let fraction = fractions[phase];
      let bits = bitcast<u32>(fraction); let magnitude = bits & 0x7fffffffu;
      if (magnitude > 0x3f800000u || ((bits >> 31u) != 0u && magnitude != 0u)) { invalid = true; }
      sum += fraction;
      if (magnitude != 0u) {
        let exponent = pc_fraction_exponent(bits);
        common_exponent = select(min(common_exponent, exponent), exponent, positive == 0u);
        if (positive == 0u) { first_phase = phase; }
        last_phase = phase;
        positive++;
      }
    }
    if (invalid || positive == 0u || positive > 2u || abs(sum - 1.0) > 0.0000001) {
      atomicOr(&pc_control[0], PC_FRACTION); continue;
    }
    // Admission above allows at most two positive phases. A pure phase owns
    // the whole integer packet. For a pair, cumulative allocation is exactly
    // floor(M*w_first/(w_first+w_last)) and its integer remainder. This needs
    // one ratio evaluation instead of evaluating both ends of all four lanes.
    if (positive == 1u) {
      for (var limb = 0u; limb < EM_WORDS; limb++) {
        pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = mass.words[limb];
      }
      atomicAdd(&pc_control[2], 1u); continue;
    }
    let first_weight = pc_fraction_weight(bitcast<u32>(fractions[first_phase]), common_exponent);
    let last_weight = pc_fraction_weight(bitcast<u32>(fractions[last_phase]), common_exponent);
    let denominator = em_add(first_weight.value, last_weight.value);
    var error = first_weight.error | last_weight.error | denominator.error;
    if (error != 0u) { atomicOr(&pc_control[0], error | PC_RATIO_CAPACITY); continue; }
    let first = em_multiply_ratio(mass, first_weight.value, denominator.value);
    let last = em_subtract(mass, first.value);
    let allocated = em_add(first.value, last.value);
    error |= first.error | last.error | allocated.error;
    for (var limb = 0u; limb < EM_WORDS; limb++) {
      pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = first.value.words[limb];
      pc_packets[(row * 4u + last_phase) * EM_WORDS + limb] = last.value.words[limb];
    }
    if (!em_zero(first.value)) { atomicAdd(&pc_control[2], 1u); }
    if (!em_zero(last.value)) { atomicAdd(&pc_control[2], 1u); }
    if (em_compare(allocated.value, mass) != 0) { error |= PC_CONSERVATION; }
    if (error != 0u) { atomicOr(&pc_control[0], error); }
  }
}

@compute @workgroup_size(32)
fn gather_phase_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.y || !pc_valid_layout() || atomicLoad(&pc_control[0]) != 0u) { return; }
  let lineage = id.x % pc_shape.x; let target_phase = id.x / pc_shape.x;
  var mass: ExactMass; var error = 0u;
  for (var source = 0u; source < 4u; source++) {
    let row = source * pc_shape.x + lineage; var packet: ExactMass;
    for (var limb = 0u; limb < EM_WORDS; limb++) {
      packet.words[limb] = pc_packets[(row * 4u + target_phase) * EM_WORDS + limb];
    }
    let total = em_add(mass, packet); mass = total.value; error |= total.error;
  }
  for (var limb = 0u; limb < EM_WORDS; limb++) { pc_sum[id.x * EM_WORDS + limb] = mass.words[limb]; }
  if (error != 0u) { atomicOr(&pc_control[0], error); }
}

@compute @workgroup_size(32)
fn commit_phase_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.y || !pc_valid_layout()) { return; }
  let accepted = atomicLoad(&pc_control[0]) == 0u;
  for (var limb = 0u; limb < EM_WORDS; limb++) {
    let at = id.x * EM_WORDS + limb;
    pc_output[at] = select(pc_mass[at], pc_sum[at], accepted);
    if (!accepted) {
      for (var phase = 0u; phase < 4u; phase++) { pc_packets[(id.x * 4u + phase) * EM_WORDS + limb] = 0u; }
    }
  }
}
`;
}
