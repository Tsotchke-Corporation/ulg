import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { createSphExactMassLedgerSuccessorWebGpu, acquireSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory } from './sphExactMassInventoryGpu.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT, SPH_EXACT_THERMAL_ENERGY_WORDS,
  sphExactThermalEnergyRecordWords } from './sphExactThermalEnergyWgsl.js';
import { schroederPhaseSlotCaloricWgsl } from './schroederPhaseSlotCaloricWgsl.js';

// Refinement is a permutation/split of extensive integer records. U and its
// cumulative source S move together; merge heat is added to both, preserving
// sum(U-S). Reject the physical decision before ANY writes if an integer
// operation, projection or caloric lookup fails. No host decision or fence.
const paramsWgsl = /* wgsl */ `
struct LedgerParams {
  particle_count: u32, lineage_capacity: u32, assignment_count: u32, mass_offset: u32,
  segment_count: u32, pad0: u32, pad1: u32, pad2: u32,
};
`;

const PREPARED_STRIDE_WGSL = 'const PREPARED_STRIDE: u32 = 10u;';

export const schroederPhaseSlotLedgerPrepareWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${paramsWgsl}
${PREPARED_STRIDE_WGSL}
@group(0) @binding(0) var<storage, read> assignments: array<f32>;
@group(0) @binding(1) var<storage, read> spare_lineages: array<u32>;
@group(0) @binding(2) var<storage, read_write> prepared: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> mass_in: array<u32>;
@group(0) @binding(4) var<storage, read_write> mass_out: array<u32>;
@group(0) @binding(5) var<storage, read> energy_in: array<u32>;
@group(0) @binding(6) var<storage, read_write> energy_out: array<u32>;
@group(0) @binding(7) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> segments: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> projections: array<vec4<f32>>;
@group(0) @binding(10) var<uniform> params: LedgerParams;
@group(0) @binding(11) var<storage, read_write> evidence: array<atomic<u32>>;
fn reject_ledger() { atomicAdd(&evidence[5], 1u); }
fn finite(v: f32) -> bool { return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u; }
fn finite4(v: vec4<f32>) -> bool { return finite(v.x) && finite(v.y) && finite(v.z) && finite(v.w); }
fn integer(v: f32) -> bool { return finite(v) && v >= 0.0 && v == floor(v); }
${schroederPhaseSlotCaloricWgsl}
fn field(row: u32, column: u32) -> f32 { return assignments[row * 32u + column]; }
fn load_mass(row: u32) -> ExactMass {
  var v: ExactMass;
  for (var w = 0u; w < EM_WORDS; w++) { v.words[w] = mass_in[params.mass_offset + row * EM_WORDS + w]; }
  return v;
}
fn load_energy(row: u32, source: u32) -> ExactMass {
  var v: ExactMass;
  for (var w = 0u; w < EM_WORDS; w++) { v.words[w] = energy_in[(row + source * params.particle_count) * EM_WORDS + w]; }
  return v;
}
fn store_row(row: u32, m: ExactMass, u: ExactMass, s: ExactMass) {
  for (var w = 0u; w < EM_WORDS; w++) {
    mass_out[row * EM_WORDS + w] = m.words[w];
    energy_out[row * EM_WORDS + w] = u.words[w];
    energy_out[(row + params.particle_count) * EM_WORDS + w] = s.words[w];
  }
}
// divisor <= the fixed row capacity (24 bits): remainder * 2 cannot overflow.
fn quotient(value: ExactMass, divisor: u32) -> ExactMass {
  var q: ExactMass; var remainder = 0u;
  for (var w = i32(EM_WORDS) - 1; w >= 0; w--) {
    for (var b = 31i; b >= 0; b--) {
      remainder = (remainder << 1u) | ((value.words[u32(w)] >> u32(b)) & 1u);
      if (remainder >= divisor) { remainder -= divisor; q.words[u32(w)] |= 1u << u32(b); }
    }
  }
  return q;
}
fn signed_quotient(value: ExactMass, divisor: u32) -> ExactMassResult {
  let magnitude = el_magnitude(value);
  var q = quotient(magnitude.value, divisor);
  if (el_negative(value)) { q = el_negate(q); }
  return ExactMassResult(q, magnitude.error);
}
fn projection(m: ExactMass, u: ExactMass, material: f32, phase: f32) -> vec4<f32> {
  let mb = em_project_f32_bits(m); let ub = el_project_f32_bits(u);
  let mass = bitcast<f32>(mb.bits); let energy = bitcast<f32>(ub.bits);
  if ((mb.error | ub.error) != 0u || !finite(mass) || mass <= 0.0 || !finite(energy)) { return vec4<f32>(0.0); }
  let specific = energy / mass;
  let temperature = phase_temperature(material, specific, phase);
  if (!finite(specific) || !finite(temperature) || temperature <= 0.0) { return vec4<f32>(0.0); }
  return vec4<f32>(mass, specific, temperature, 1.0);
}
fn member(row: u32, group: f32) -> bool {
  return field(row, 3u) > 0.0 && field(row, 3u) < 32.0 && field(row, 6u) == 1.0
    && field(row, 20u) == group
    && ((field(row, 8u) == 6.0 && field(row, 9u) == field(row, 0u) && field(row, 10u) == 1.0 && field(row, 12u) == 0.0)
      || (field(row, 8u) == 7.0 && field(row, 11u) == field(row, 0u) && field(row, 12u) == 1.0));
}
fn prepared_member_row(row: u32, m: u32) -> f32 {
  let v = select(prepared[row * PREPARED_STRIDE + 8u], prepared[row * PREPARED_STRIDE + 9u], m >= 4u);
  let k = m & 3u;
  if (k == 0u) { return v.x; }
  if (k == 1u) { return v.y; }
  if (k == 2u) { return v.z; }
  return v.w;
}
@compute @workgroup_size(64)
fn prepare_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.assignment_count) { return; }
  let p = prepared[row * PREPARED_STRIDE];
  if (p.x != 1.0) { return; }
  // Disable the physical writer until the whole group passes. Other groups
  // never inspect this decision in this pass; merge members wait for the next.
  prepared[row * PREPARED_STRIDE].x = 0.0;
  let i = u32(p.y); let t0 = source_thermo[i * 3u]; let material = t0.x; let phase = t0.y;
  let source_lane = i / params.lineage_capacity;
  if (field(row, 8u) == 5.0) {
    let count = u32(p.w) + 1u; let rank = u32(p.z);
    for (var n = 1u; n < count; n++) {
      let lineage = spare_lineages[rank + n - 1u];
      for (var lane = 0u; lane < 4u; lane++) {
        let destination = lane * params.lineage_capacity + lineage;
        // A zero f32 view cannot authorize overwriting hidden integer mass,
        // energy or source history in any companion of a reserved lineage.
        if (!em_zero(load_mass(destination)) || !em_zero(load_energy(destination, 0u))
            || !em_zero(load_energy(destination, 1u))) { reject_ledger(); return; }
      }
    }
    let mass = load_mass(i); let energy = load_energy(i, 0u); let source = load_energy(i, 1u);
    let child_m = quotient(mass, count);
    let child_u = signed_quotient(energy, count); let child_s = signed_quotient(source, count);
    if ((child_u.error | child_s.error) != 0u || em_zero(child_m)) { reject_ledger(); return; }
    var rem_m = mass; var rem_u = energy; var rem_s = source;
    for (var n = 1u; n < count; n++) {
      let mm = em_subtract(rem_m, child_m); let uu = el_subtract(rem_u, child_u.value);
      let ss = el_subtract(rem_s, child_s.value);
      if ((mm.error | uu.error | ss.error) != 0u) { reject_ledger(); return; }
      rem_m = mm.value; rem_u = uu.value; rem_s = ss.value;
    }
    let parent_view = projection(rem_m, rem_u, material, phase);
    let child_view = projection(child_m, child_u.value, material, phase);
    if (parent_view.w != 1.0 || child_view.w != 1.0) { reject_ledger(); return; }
    projections[row * 2u] = parent_view; projections[row * 2u + 1u] = child_view;
    store_row(i, rem_m, rem_u, rem_s);
    for (var n = 1u; n < count; n++) {
      store_row(source_lane * params.lineage_capacity + spare_lineages[rank + n - 1u], child_m, child_u.value, child_s.value);
    }
  } else if (field(row, 8u) == 6.0) {
    let group = field(row, 20u);
    let p7 = prepared[row * PREPARED_STRIDE + 7u];
    let fast_group = p7.y < 0.5 && p.z >= 2.0 && p.z <= 8.0;
    let member_count = u32(p.z);
    var mass: ExactMass; var energy: ExactMass; var source: ExactMass;
    if (fast_group) {
      for (var m = 0u; m < member_count; m++) {
        let r_f = prepared_member_row(row, m);
        if (r_f < 0.0) { reject_ledger(); return; }
        let r = u32(r_f);
        let j = u32(field(r, 0u)); let mj = load_mass(j);
        if (em_zero(mj)) { reject_ledger(); return; }
        let mm = em_add(mass, mj); let uu = el_add(energy, load_energy(j, 0u));
        let ss = el_add(source, load_energy(j, 1u));
        if ((mm.error | uu.error | ss.error) != 0u) { reject_ledger(); return; }
        mass = mm.value; energy = uu.value; source = ss.value;
      }
    } else {
      for (var r = 0u; r < params.assignment_count; r++) {
        if (!member(r, group)) { continue; }
        let j = u32(field(r, 0u)); let mj = load_mass(j);
        if (em_zero(mj)) { reject_ledger(); return; }
        let mm = em_add(mass, mj); let uu = el_add(energy, load_energy(j, 0u));
        let ss = el_add(source, load_energy(j, 1u));
        if ((mm.error | uu.error | ss.error) != 0u) { reject_ledger(); return; }
        mass = mm.value; energy = uu.value; source = ss.value;
      }
    }
    let heat = el_from_f32_bits(bitcast<u32>(p7.x));
    let uu = el_add(energy, heat.value); let ss = el_add(source, heat.value);
    if ((heat.error | uu.error | ss.error) != 0u) { reject_ledger(); return; }
    let view = projection(mass, uu.value, material, phase);
    if (view.w != 1.0) { reject_ledger(); return; }
    projections[row * 2u] = view;
    if (fast_group) {
      for (var m = 0u; m < member_count; m++) {
        let r = u32(prepared_member_row(row, m));
        store_row(u32(field(r, 0u)), ExactMass(), ExactMass(), ExactMass());
      }
    } else {
      for (var r = 0u; r < params.assignment_count; r++) {
        if (member(r, group)) { store_row(u32(field(r, 0u)), ExactMass(), ExactMass(), ExactMass()); }
      }
    }
    store_row(i, mass, uu.value, ss.value);
  } else { reject_ledger(); return; }
  prepared[row * PREPARED_STRIDE].x = 1.0;
}
`;

export const schroederPhaseSlotLedgerProjectWgsl = /* wgsl */ `
${paramsWgsl}
${PREPARED_STRIDE_WGSL}
@group(0) @binding(0) var<storage, read> assignments: array<f32>;
@group(0) @binding(1) var<storage, read> spare_lineages: array<u32>;
@group(0) @binding(2) var<storage, read> prepared: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> projections: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: LedgerParams;
fn project(row: u32, view: vec4<f32>) {
  let old_mass = state[row * 2u].w;
  // Preserve the physical writer's current/rest volume and reference-mass
  // ratios when the integer mass projection changes by rounding.
  let ratio = view.x / old_mass; let radius_ratio = pow(ratio, 1.0 / 3.0);
  state[row * 2u].w = view.x; state[row * 2u + 1u].w = view.y;
  thermo[row * 3u].z = view.z;
  let t = thermo[row * 3u + 2u];
  thermo[row * 3u + 2u] = vec4<f32>(t.x * radius_ratio, t.y * ratio, t.z, t.w * radius_ratio);
  mechanics[row * 8u + 4u].w *= ratio;
  mechanics[row * 8u + 7u].w *= ratio;
}
@compute @workgroup_size(64)
fn project_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.assignment_count) { return; }
  let p = prepared[row * PREPARED_STRIDE];
  if (p.x != 1.0) { return; }
  let leader = u32(p.y);
  let source_lane = leader / params.lineage_capacity;
  project(leader, projections[row * 2u]);
  if (assignments[row * 32u + 8u] == 5.0) {
    for (var n = 0u; n < u32(p.w); n++) {
      project(source_lane * params.lineage_capacity + spare_lineages[u32(p.z) + n], projections[row * 2u + 1u]);
    }
  }
}
`;

export function createSchroederPhaseSlotLedgerStage({ device, particleCount, lineageCapacity,
  assignmentRowCount, massRead, energy, preparationBuffer, evidenceBuffer, segmentBuffer, segmentCount,
  outStateBuffer, outThermoBuffer, outMechanicsBuffer } = {}) {
  if (!energy || energy.rowCount !== particleCount || massRead?.rowCount !== particleCount
      || massRead.format !== energy.format || energy.format.wordCount !== SPH_EXACT_THERMAL_ENERGY_WORDS
      || energy.format.quantumExponent !== SPH_EXACT_THERMAL_ENERGY_FORMAT.quantumExponent
      || energy.energyBuffer?.size !== sphExactThermalEnergyRecordWords(particleCount) * 4
      || particleCount !== lineageCapacity * 4 || massRead.byteOffset % 4 !== 0) {
    throw new TypeError('Phase-slot ledger requires aligned standard integer mass and energy records');
  }
  if (!evidenceBuffer || evidenceBuffer.size < 32) throw new TypeError('Phase-slot ledger requires retained validation');
  for (const buffer of [energy.energyBuffer, preparationBuffer, evidenceBuffer, segmentBuffer,
    outStateBuffer, outThermoBuffer, outMechanicsBuffer]) {
    if (webGpuBufferDevice(buffer) !== device) throw new TypeError('Phase-slot ledger requires same-device storage');
  }
  const successor = createSphExactMassLedgerSuccessorWebGpu({ device, sourceRead: massRead });
  const owned = [];
  const make = (label, size, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device); owned.push(b); return b;
  };
  let settled = false, prepared = false, projected = false, projectGroup = null;
  try {
    const energyOutput = make('ulg-phase-slot-integer-energy', energy.energyBuffer.size);
    const projections = make('ulg-phase-slot-integer-projections', assignmentRowCount * 32);
    const uniform = make('ulg-phase-slot-integer-params', 32, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    device.queue.writeBuffer(uniform, 0, new Uint32Array([particleCount, lineageCapacity,
      assignmentRowCount, massRead.byteOffset / 4, segmentCount, 0, 0, 0]));
    const preparePipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-phase-slot-ledger-prepare.v4', label: 'ulg-phase-slot-ledger-prepare',
      code: schroederPhaseSlotLedgerPrepareWgsl, entryPoint: 'prepare_ledger',
      bindings: ['read-only-storage', 'read-only-storage', 'storage', 'read-only-storage', 'storage',
        'read-only-storage', 'storage', 'read-only-storage', 'read-only-storage', 'storage', 'uniform', 'storage']
        .map((type, binding) => computeBufferBinding(binding, type)) });
    const projectPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-phase-slot-ledger-project.v3', label: 'ulg-phase-slot-ledger-project',
      code: schroederPhaseSlotLedgerProjectWgsl, entryPoint: 'project_ledger',
      bindings: ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
        'storage', 'storage', 'storage', 'uniform'].map((type, binding) => computeBufferBinding(binding, type)) });
    const group = (pipeline, buffers) => createCachedExplicitBindGroup(device, { layout: pipeline.bindGroupLayout,
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const dispatch = (encoder, pipeline, bindGroup) => {
      const pass = encoder.beginComputePass({ label: pipeline.label });
      pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(assignmentRowCount / 64)); pass.end();
    };
    return Object.freeze({
      encodePrepare(encoder, { slotAssignmentBuffer, spareLineagesBuffer, sourceThermoBuffer }) {
        if (settled || prepared) throw new Error('Phase-slot ledger preparation is single-use');
        prepared = true;
        encoder.copyBufferToBuffer(massRead.buffer, massRead.byteOffset, successor.buffer, 0, successor.buffer.size);
        encoder.copyBufferToBuffer(energy.energyBuffer, 0, energyOutput, 0, energyOutput.size);
        const prepareGroup = group(preparePipeline, [slotAssignmentBuffer, spareLineagesBuffer, preparationBuffer,
          massRead.buffer, successor.buffer, energy.energyBuffer, energyOutput, sourceThermoBuffer,
          segmentBuffer, projections, uniform, evidenceBuffer]);
        projectGroup = group(projectPipeline, [slotAssignmentBuffer, spareLineagesBuffer, preparationBuffer,
          projections, outStateBuffer, outThermoBuffer, outMechanicsBuffer, uniform]);
        dispatch(encoder, preparePipeline, prepareGroup);
      },
      encodeProject(encoder) {
        if (settled || !prepared || projected) throw new Error('Phase-slot ledger projection requires its prepared candidate');
        projected = true; dispatch(encoder, projectPipeline, projectGroup);
      },
      commit() {
        if (settled || !projected) throw new Error('Phase-slot ledger commit requires its encoded candidate');
        settled = true; uniform.destroy(); projections.destroy();
        const family = successor.commit(); const carrierMassRead = acquireSphExactMassRead({ family, device });
        // The retained read is now the owner; forks remain available while it
        // lives, and closing the last read retires this family automatically.
        releaseSphExactMassInventory(family);
        let adopted = false;
        return Object.freeze({ carrierMassRead,
          exactEnergy: Object.freeze({ energyBuffer: energyOutput, format: energy.format, rowCount: particleCount }),
          transferExactEnergy() {
            if (adopted) throw new Error('Phase-slot energy was already adopted'); adopted = true;
          },
          get energyAdopted() { return adopted; } });
      },
      abandon() {
        if (settled) return false; settled = true;
        successor.abandon(); for (const b of owned) b.destroy(); return true;
      },
      releaseUnadopted(record) {
        return releaseSphExactMassRead(record.carrierMassRead, { deferInBurst: true }).then(() => {
          if (!record.energyAdopted) energyOutput.destroy();
        });
      }
    });
  } catch (error) { successor.abandon(); for (const b of owned) b.destroy(); throw error; }
}
