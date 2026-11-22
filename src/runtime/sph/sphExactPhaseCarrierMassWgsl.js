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

// Exact 2^-149 integer-mass phase packet selector with Stefan skin-first
// interface phase partition (plan/todo/interface-resolution.md). Used only when
// an active interface front epoch is present; non-front runs keep the 6-binding
// shader above bit-for-bit unchanged.
export function createSphExactPhaseCarrierMassSkinWgsl(format) {
  return createSphExactMassWgsl(format) + /* wgsl */ `
const PC_LAYOUT: u32 = 0x01000000u;
const PC_FRACTION: u32 = 0x02000000u;
const PC_MATERIAL: u32 = 0x04000000u;
const PC_RATIO_CAPACITY: u32 = 0x08000000u;
const PC_CONSERVATION: u32 = 0x10000000u;
struct PcSkinShape {
  lineage_capacity: u32,
  row_count: u32,
  front_enabled: u32,
  front_epoch: u32,
  front_header_words: u32,
  front_row_words: u32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(0) var<storage, read> pc_mass: array<u32>;
@group(0) @binding(1) var<storage, read> pc_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pc_packets: array<u32>;
@group(0) @binding(3) var<storage, read_write> pc_sum: array<u32>;
@group(0) @binding(4) var<storage, read_write> pc_output: array<u32>;
@group(0) @binding(5) var<storage, read_write> pc_control: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> pc_shape: PcSkinShape;
@group(0) @binding(7) var<storage, read> interface_front: array<u32>;
@group(0) @binding(8) var<storage, read> pc_source_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read> pc_source_mechanics: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> pc_skin_scratch: array<vec4<f32>>;

fn pc_finite(v: f32) -> bool { return (bitcast<u32>(v) & 0x7fffffffu) < 0x7f800000u; }
fn pc_valid_layout() -> bool {
  let rows = pc_shape.lineage_capacity * 4u;
  return pc_shape.lineage_capacity > 0u && rows / 4u == pc_shape.lineage_capacity && pc_shape.row_count == rows
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
  if (id.x >= pc_shape.lineage_capacity) { return; }
  if (!pc_valid_layout()) { atomicOr(&pc_control[0], PC_LAYOUT); return; }
  var lineage_material = 0.0;
  for (var source_lane = 0u; source_lane < 4u; source_lane++) {
    let row = source_lane * pc_shape.lineage_capacity + id.x;
    pc_skin_scratch[row * 8u] = vec4<f32>(0.0);
    pc_skin_scratch[row * 8u + 1u] = vec4<f32>(0.0);
    pc_skin_scratch[row * 8u + 2u] = vec4<f32>(0.0);
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
    if (positive == 1u) {
      // Check Stefan skin-first interface front conversion on pure-phase bulk carrier.
      var skin_applied = false;
      if (pc_shape.front_enabled == 1u && pc_shape.front_epoch != 0u && pc_shape.front_row_words >= 24u) {
        let f_base = pc_shape.front_header_words + row * pc_shape.front_row_words;
        if (f_base + 24u <= arrayLength(&interface_front)) {
          let stamp = interface_front[f_base + 19u];
          let own_phase = first_phase + 1u;
          let target_phase = stamp & 7u;
          let adjacent = (target_phase == own_phase + 1u) || (target_phase + 1u == own_phase);
          if ((stamp >> 3u) == pc_shape.front_epoch && target_phase >= 1u && target_phase <= 4u && adjacent) {
            let s0 = pc_source_state[row * 2u];
            let s1 = pc_source_state[row * 2u + 1u];
            let skin_energy_j = bitcast<f32>(interface_front[f_base + 15u]);
            let source_energy = bitcast<f32>(interface_front[f_base + 16u]);
            let target_energy = bitcast<f32>(interface_front[f_base + 17u]);
            let front_temp = bitcast<f32>(interface_front[f_base + 18u]);
            let face_offset = vec3<f32>(
              bitcast<f32>(interface_front[f_base + 20u]),
              bitcast<f32>(interface_front[f_base + 21u]),
              bitcast<f32>(interface_front[f_base + 22u])
            );
            let denom = target_energy - source_energy;
            var condensed_ok = true;
            if (target_phase <= 2u) {
              let t_idx = (target_phase - 1u) * pc_shape.lineage_capacity + id.x;
              let t_s0 = pc_source_state[t_idx * 2u];
              if (!(t_s0.w > 1e-20)) { condensed_ok = false; }
              else {
                let own_edge = pow(max(pc_source_mechanics[row * 8u + 4u].z * pc_source_mechanics[row * 8u + 4u].w, 0.0), 1.0 / 3.0);
                let tgt_edge = pow(max(pc_source_mechanics[t_idx * 8u + 4u].z * pc_source_mechanics[t_idx * 8u + 4u].w, 0.0), 1.0 / 3.0);
                if (!(distance(s0.xyz + face_offset, t_s0.xyz) <= 0.5 * (own_edge + tgt_edge))) {
                  condensed_ok = false;
                }
              }
            }
            if (condensed_ok && s0.w > 1e-20 && pc_finite(skin_energy_j) && pc_finite(source_energy)
                && pc_finite(target_energy) && pc_finite(front_temp) && pc_finite(denom)
                && pc_finite(face_offset.x) && pc_finite(face_offset.y) && pc_finite(face_offset.z)
                && denom != 0.0 && skin_energy_j * denom > 0.0 && front_temp > 0.0) {
              let converted_f = min(skin_energy_j / denom, s0.w);
              if (converted_f > 1e-20) {
                let target_lane = target_phase - 1u;
                if (s0.w - converted_f <= 1e-20) {
                  for (var limb = 0u; limb < EM_WORDS; limb++) {
                    pc_packets[(row * 4u + target_lane) * EM_WORDS + limb] = mass.words[limb];
                  }
                  pc_skin_scratch[row * 8u] = vec4<f32>(1.0, f32(target_phase), s1.w, s1.w);
                  pc_skin_scratch[row * 8u + 1u] = vec4<f32>(0.0, 0.0, 0.0, f32(own_phase));
                  pc_skin_scratch[row * 8u + 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
                  atomicAdd(&pc_control[2], 1u);
                  skin_applied = true;
                } else {
                  let skin_frac = clamp(converted_f / s0.w, 1e-7, 1.0 - 1e-7);
                  let rem_frac = 1.0 - skin_frac;
                  let own_energy = (s1.w - skin_frac * target_energy) / rem_frac;
                  if (pc_finite(own_energy)) {
                    let b_skin = bitcast<u32>(skin_frac);
                    let b_rem = bitcast<u32>(rem_frac);
                    let c_exp = min(pc_fraction_exponent(b_skin), pc_fraction_exponent(b_rem));
                    let w_skin = pc_fraction_weight(b_skin, c_exp);
                    let w_rem = pc_fraction_weight(b_rem, c_exp);
                    let w_tot = em_add(w_skin.value, w_rem.value);
                    var s_err = w_skin.error | w_rem.error | w_tot.error;
                    if (s_err == 0u) {
                      let conv_em = em_multiply_ratio(mass, w_skin.value, w_tot.value);
                      let rem_em = em_subtract(mass, conv_em.value);
                      let chk = em_add(conv_em.value, rem_em.value);
                      s_err |= conv_em.error | rem_em.error | chk.error;
                      if (s_err == 0u && em_compare(chk.value, mass) == 0 && !em_zero(conv_em.value) && !em_zero(rem_em.value)) {
                        for (var limb = 0u; limb < EM_WORDS; limb++) {
                          pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = rem_em.value.words[limb];
                          pc_packets[(row * 4u + target_lane) * EM_WORDS + limb] = conv_em.value.words[limb];
                        }
                        let conv_offset = select(vec3<f32>(0.0), face_offset, target_phase >= 3u);
                        let own_offset = -conv_offset * (skin_frac / rem_frac);
                        pc_skin_scratch[row * 8u] = vec4<f32>(1.0, f32(target_phase), own_energy, target_energy);
                        pc_skin_scratch[row * 8u + 1u] = vec4<f32>(own_offset, f32(own_phase));
                        pc_skin_scratch[row * 8u + 2u] = vec4<f32>(conv_offset, 0.0);
                        atomicAdd(&pc_control[2], 2u);
                        skin_applied = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (!skin_applied) {
        for (var limb = 0u; limb < EM_WORDS; limb++) {
          pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = mass.words[limb];
        }
        atomicAdd(&pc_control[2], 1u);
      }
      continue;
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
  if (id.x >= pc_shape.row_count || !pc_valid_layout() || atomicLoad(&pc_control[0]) != 0u) { return; }
  let lineage = id.x % pc_shape.lineage_capacity; let target_phase = id.x / pc_shape.lineage_capacity;
  var mass: ExactMass; var error = 0u;
  for (var source = 0u; source < 4u; source++) {
    let row = source * pc_shape.lineage_capacity + lineage; var packet: ExactMass;
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
  if (id.x >= pc_shape.row_count || !pc_valid_layout()) { return; }
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
