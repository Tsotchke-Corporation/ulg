import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { createSphExactMassLedgerSuccessorWebGpu, acquireSphExactMassRead, releaseSphExactMassRead,
  releaseSphExactMassInventory }
  from './sphExactMassInventoryGpu.js';
import {
  SPH_EXACT_THERMAL_ENERGY_FORMAT, SPH_EXACT_THERMAL_ENERGY_WORDS, SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS,
  sphExactThermalEnergyRecordWords
} from './sphExactThermalEnergyWgsl.js';

// Integer energy-ledger phase transfer (plan/todo/g2-integer-ledger-proposal.md,
// Phase 2, user 2026-11-13: keep the type-2 plateau rule and make it exact).
// The f32 phase-carrier transfer still decides how much mass and energy each
// phase lane of a lineage receives. This pass runs after it in the same
// submission and makes that split exact, one thread per lineage:
//   - each non-remainder lane takes its f32 mass as an exact packet, clamped
//     to what remains of the lineage's exact mass, and fl32(m*u) as its exact
//     energy packet; a lane with exact zero mass carries no energy;
//   - the largest lane takes the exact remainder of the mass, and of the
//     energy plus the thermalized kinetic energy, which is a recorded source;
//   - every lane's f32 mass, u, rest volume and lane-31 reference mass are
//     rewritten from the integer rows, so u stays the ledger's projection
//     (an empty lane keeps the transfer's in-domain u for its zero energy).
// The f32 transfer's own lever-rule tolerance is absorbed by the remainder
// lane instead of creating or destroying energy.
export const SPH_EXACT_PHASE_LEDGER_LANES = 4;
export const SPH_EXACT_PHASE_LEDGER_ERROR = Object.freeze({ ORPHAN_ENERGY: 32, ARITHMETIC: 64 });

const PARAMS_BYTES = 16;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, COPY_SRC: 0x04, COPY_DST: 0x08, UNIFORM: 0x40 });

export const sphExactPhaseLedgerReconcileWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
struct ReconcileParams {
  lineage_count: u32,
  lane_stride: u32,
  particle_count: u32,
  mass_offset_words: u32,
};

@group(0) @binding(0) var<storage, read> input_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> out_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> mass_in: array<u32>;
@group(0) @binding(5) var<storage, read_write> mass_out: array<u32>;
@group(0) @binding(6) var<storage, read> energy_in: array<u32>;
@group(0) @binding(7) var<storage, read_write> energy_out: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ReconcileParams;

const LANES: u32 = ${SPH_EXACT_PHASE_LEDGER_LANES}u;
const ERROR_ORPHAN_ENERGY: u32 = ${SPH_EXACT_PHASE_LEDGER_ERROR.ORPHAN_ENERGY}u;
const ERROR_ARITHMETIC: u32 = ${SPH_EXACT_PHASE_LEDGER_ERROR.ARITHMETIC}u;

fn load_mass(row: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = mass_in[params.mass_offset_words + row * EM_WORDS + i]; }
  return value;
}
fn load_energy(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = energy_in[word + i]; }
  return value;
}
fn store_mass(row: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { mass_out[row * EM_WORDS + i] = value.words[i]; }
}
fn store_energy(word: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&energy_out[word + i], value.words[i]); }
}
fn kinetic_energy(state: vec4<f32>, velocity: vec4<f32>) -> f32 {
  return 0.5 * state.w * dot(velocity.xyz, velocity.xyz);
}

// Control words follow the U and S rows; the predecessor's are carried.
@compute @workgroup_size(${SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS})
fn carry_ledger_control(@builtin(local_invocation_index) word: u32) {
  let base = 2u * params.particle_count * EM_WORDS;
  atomicStore(&energy_out[base + word], energy_in[base + word]);
}

@compute @workgroup_size(64)
fn reconcile_phase_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  let lineage = id.x;
  if (lineage >= params.lineage_count) { return; }
  let rows = params.particle_count * EM_WORDS;
  var mass_total: ExactMass;
  var energy_total: ExactMass;
  var source_total: ExactMass;
  var errors = 0u;
  var kinetic_in = 0.0;
  var kinetic_out = 0.0;
  var remainder_lane = LANES;
  var remainder_mass = -1.0;
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count) { continue; }
    let mass = em_add(mass_total, load_mass(row));
    let energy = el_add(energy_total, load_energy(row * EM_WORDS));
    let source = el_add(source_total, load_energy(rows + row * EM_WORDS));
    errors |= select(0u, ERROR_ARITHMETIC, (mass.error | energy.error | source.error) != 0u);
    mass_total = mass.value; energy_total = energy.value; source_total = source.value;
    kinetic_in += kinetic_energy(input_state[row * 2u], input_state[row * 2u + 1u]);
    let out0 = out_state[row * 2u];
    kinetic_out += kinetic_energy(out0, out_state[row * 2u + 1u]);
    if (out0.w > remainder_mass) { remainder_mass = out0.w; remainder_lane = lane; }
  }
  // The transfer thermalizes the kinetic energy its momentum merge removes;
  // that conversion is a source of internal energy, never an exchange.
  let thermalized = el_from_f32_bits(bitcast<u32>(max(kinetic_in - kinetic_out, 0.0)));
  let budget = el_add(energy_total, thermalized.value);
  let sources = el_add(source_total, thermalized.value);
  errors |= select(0u, ERROR_ARITHMETIC, (thermalized.error | budget.error | sources.error) != 0u);
  var mass_left = mass_total;
  var energy_left = budget.value;
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count || lane == remainder_lane) { continue; }
    let out0 = out_state[row * 2u];
    // Explicit zero per iteration: a declaration without an initializer kept
    // the previous lane's value on the native compiler.
    var lane_mass = ExactMass();
    var lane_energy = ExactMass();
    if (out0.w > 0.0) {
      let packet = el_from_f32_bits(bitcast<u32>(out0.w));
      errors |= select(0u, ERROR_ARITHMETIC, packet.error != 0u);
      // Clamp to what remains of the lineage with an integer compare.
      lane_mass = packet.value;
      if (em_compare(packet.value, mass_left) > 0) { lane_mass = mass_left; }
      if (!em_zero(lane_mass)) {
        let lane_u = out_state[row * 2u + 1u].w;
        let energy_packet = el_from_f32_bits(bitcast<u32>(out0.w * lane_u));
        errors |= select(0u, ERROR_ARITHMETIC, energy_packet.error != 0u);
        lane_energy = energy_packet.value;
      }
    }
    let mass_next = em_subtract(mass_left, lane_mass);
    let energy_next = el_subtract(energy_left, lane_energy);
    errors |= select(0u, ERROR_ARITHMETIC, (mass_next.error | energy_next.error) != 0u);
    mass_left = mass_next.value; energy_left = energy_next.value;
    store_mass(row, lane_mass);
    store_energy(row * EM_WORDS, lane_energy);
    store_energy(rows + row * EM_WORDS, ExactMass());
  }
  if (remainder_lane < LANES) {
    let row = remainder_lane * params.lane_stride + lineage;
    if (em_zero(mass_left) && !em_zero(energy_left)) { errors |= ERROR_ORPHAN_ENERGY; }
    store_mass(row, mass_left);
    store_energy(row * EM_WORDS, energy_left);
    store_energy(rows + row * EM_WORDS, sources.value);
  }
  // u, mass and the mass-derived mechanics lanes are the integer rows' view.
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count) { continue; }
    var mass_value: ExactMass;
    var energy_value: ExactMass;
    for (var i = 0u; i < EM_WORDS; i++) {
      mass_value.words[i] = mass_out[row * EM_WORDS + i];
      energy_value.words[i] = atomicLoad(&energy_out[row * EM_WORDS + i]);
    }
    let mass_bits = em_project_f32_bits(mass_value);
    let energy_bits = el_project_f32_bits(energy_value);
    errors |= select(0u, ERROR_ARITHMETIC, (mass_bits.error | energy_bits.error) != 0u);
    let mass = bitcast<f32>(mass_bits.bits);
    let state0 = out_state[row * 2u];
    let state1 = out_state[row * 2u + 1u];
    // An empty lane keeps the transfer's in-domain u: its exact energy is 0,
    // which the next ledger step recognises as fl32(0 * u). A lane whose
    // projection differs from the transfer's u by rounding only also keeps
    // the transfer's u: at a phase-domain boundary that ulp would otherwise
    // leave the lane unclassifiable (phase 0 then fails the spatial
    // directory, contact and pair conduction for the whole step). "Rounding"
    // is 8 ulps, the ledger thermal stage's own bound: it holds its view up
    // to 4 ulps inside the caloric domain while the exact U/m may sit up to 4
    // ulps outside before OUTSIDE_DOMAIN, so the two legitimately differ by
    // 8 (measured: humid air at the 200 K top wall, view domain.x + 4 ulps,
    // exact domain.x - 1 ulp). U stays exact; the next ledger step books the
    // view's rounding to S as a mechanics source.
    let projected_u = bitcast<f32>(energy_bits.bits) / max(mass, 1.0e-30);
    let ulps = abs(bitcast<i32>(projected_u) - bitcast<i32>(state1.w));
    let rounding_only = (projected_u >= 0.0) == (state1.w >= 0.0) && ulps <= 8;
    let u = select(state1.w, projected_u, mass > 0.0 && !rounding_only);
    if (bitcast<u32>(state0.w) != mass_bits.bits) {
      let rest_density = out_thermo[row * 3u].w;
      let mechanics4 = out_mechanics[row * 8u + 4u];
      out_mechanics[row * 8u + 4u] = vec4<f32>(mechanics4.xyz,
        select(0.0, mass / rest_density, rest_density > 0.0));
      let mechanics7 = out_mechanics[row * 8u + 7u];
      out_mechanics[row * 8u + 7u] = vec4<f32>(mechanics7.xyz, mass);
    }
    out_state[row * 2u] = vec4<f32>(state0.xyz, mass);
    out_state[row * 2u + 1u] = vec4<f32>(state1.xyz, u);
  }
  if (errors != 0u) { atomicOr(&energy_out[2u * rows], errors); }
}
`;

/** Prepares the reconcile pass for one f32 phase transfer. Encode it after the
 * transfer, in the same encoder. The successor mass family and energy record
 * belong to the result until a continuation owner adopts them. */
export function createSphExactPhaseLedgerReconcileStage({ device, lineageCount, laneStride, particleCount,
  inputStateBuffer, outStateBuffer, outThermoBuffer, outMechanicsBuffer, massRead, energy } = {}) {
  const rowCount = particleCount;
  if (!Number.isSafeInteger(rowCount) || rowCount < 1 || !Number.isSafeInteger(lineageCount) || lineageCount < 1
      || laneStride !== lineageCount || (SPH_EXACT_PHASE_LEDGER_LANES - 1) * laneStride + lineageCount < rowCount) {
    throw new TypeError('Ledger phase reconcile requires the transfer lane layout');
  }
  if (!energy || energy.rowCount !== rowCount || energy.format.wordCount !== SPH_EXACT_THERMAL_ENERGY_WORDS
      || energy.format.quantumExponent !== SPH_EXACT_THERMAL_ENERGY_FORMAT.quantumExponent
      || energy.energyBuffer.size !== sphExactThermalEnergyRecordWords(rowCount) * 4
      || webGpuBufferDevice(energy.energyBuffer) !== device
      || massRead?.rowCount !== rowCount || massRead.format !== energy.format || massRead.byteOffset % 4 !== 0) {
    throw new TypeError('Ledger phase reconcile requires complete carrier mass and energy records');
  }
  for (const buffer of [inputStateBuffer, outStateBuffer, outThermoBuffer, outMechanicsBuffer]) {
    if (webGpuBufferDevice(buffer) !== device) throw new TypeError('Ledger phase reconcile buffers must share the device');
  }
  const massSuccessor = createSphExactMassLedgerSuccessorWebGpu({ device, sourceRead: massRead });
  let energyOutput = null, paramsBuffer = null, settled = false;
  try {
    energyOutput = tagWebGpuBufferDevice(device.createBuffer({ label: 'ulg-exact-energy-phase-ledger',
      size: energy.energyBuffer.size,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST }), device);
    paramsBuffer = device.createBuffer({ label: 'ulg-exact-phase-ledger-params', size: PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([lineageCount, laneStride, rowCount, massRead.byteOffset / 4]));
    const bindings = ['read-only-storage', 'storage', 'storage', 'read-only-storage', 'read-only-storage',
      'storage', 'read-only-storage', 'storage', 'uniform'].map((type, binding) => computeBufferBinding(binding, type));
    const pipelines = ['reconcile_phase_ledger', 'carry_ledger_control'].map(entryPoint =>
      createCachedExplicitComputePipeline(device, { cacheKey: `ulg-exact-phase-ledger-${entryPoint}.v1`,
        label: `ulg-exact-phase-ledger-${entryPoint}`, code: sphExactPhaseLedgerReconcileWgsl, entryPoint, bindings }));
    const bindGroup = device.createBindGroup({ layout: pipelines[0].bindGroupLayout, entries: [
      inputStateBuffer, outStateBuffer, outMechanicsBuffer, outThermoBuffer, massRead.buffer,
      massSuccessor.buffer, energy.energyBuffer, energyOutput, paramsBuffer
    ].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const destroyOwned = () => { energyOutput?.destroy?.(); paramsBuffer?.destroy?.(); };
    return Object.freeze({
      encode(encoder) {
        // Carry the predecessor's control words first; the reconcile then
        // ORs its own error bits into them.
        for (const [index, workgroups] of [[1, 1], [0, Math.ceil(lineageCount / 64)]]) {
          const pass = encoder.beginComputePass({ label: 'ulg-exact-phase-ledger-reconcile' });
          pass.setPipeline(pipelines[index].pipeline); pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(workgroups); pass.end();
        }
      },
      /** After submission: the successor mass read and energy record. */
      commit() {
        if (settled) throw new TypeError('Ledger phase reconcile was already settled');
        settled = true;
        paramsBuffer.destroy?.(); paramsBuffer = null;
        const family = massSuccessor.commit();
        let energyAdopted = false;
        return Object.freeze({
          carrierMassRead: acquireSphExactMassRead({ family, device }),
          exactEnergy: Object.freeze({ energyBuffer: energyOutput, format: energy.format, rowCount }),
          transferExactEnergy() {
            if (energyAdopted) throw new TypeError('Exact energy record was already adopted');
            energyAdopted = true;
          },
          get energyAdopted() { return energyAdopted; }
        });
      },
      abandon() {
        if (settled) return false;
        settled = true; massSuccessor.abandon(); destroyOwned(); return true;
      },
      releaseUnadopted(committed) {
        // The existing read-retirement fence also protects energy storage.
        // Close this producer's family after releasing its read; successor
        // uploads retain their own delegated reads. An abandoned candidate
        // must not keep the family's device record alive until device loss.
        // This replaces the caller's separate preliminary cleanup fence.
        return releaseSphExactMassRead(committed.carrierMassRead).then(() => {
          if (!committed.energyAdopted) energyOutput?.destroy?.();
          releaseSphExactMassInventory(committed.carrierMassRead.family);
        });
      }
    });
  } catch (error) {
    massSuccessor.abandon(); energyOutput?.destroy?.(); paramsBuffer?.destroy?.();
    throw error;
  }
}
