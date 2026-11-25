import { schroederPhaseSlotCaloricWgsl } from './schroederPhaseSlotCaloricWgsl.js';
import { createSchroederPhaseSlotLedgerStage } from './schroederPhaseSlotLedgerGpu.js';
import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  generateRepresentedVolumeWgsl,
  generateVec4LaneAccessorsWgsl
} from '../../../ulg-gpu-abi/src/index.js';
import { getCanonicalLawAdapterDescriptor } from './lawDagEpochScheduler.js';
import { createGpuResourceLeaseScope } from './gpuResourceLease.js';

export const SCHROEDER_PHASE_SLOT_LAW_ADAPTER_DESCRIPTOR =
  getCanonicalLawAdapterDescriptor('phase-slot-refinement');

const PHASE_SLOT_MECHANICS_ACCESSORS_WGSL = [
  generateVec4LaneAccessorsWgsl({
    layout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
    bufferName: 'source_mechanics',
    prefix: 'psm_src_mech',
    fields: [
      'volumeRatioJ',
      'restVolumeM3',
      'solidFlag',
      'status',
      'eosModelId',
      'constitutiveStatus',
      'phaseVolumeReferenceMassKg'
    ],
    includeWriters: false
  }),
  generateRepresentedVolumeWgsl({
    mechanicsLayout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    bufferName: 'source_mechanics'
  })
].join('\n\n');

// Fixed phase-carrier v2 storage. This stage produces a private candidate;
// PeerCompute adoption and constitutive refresh remain the caller's owners.
// Identity is deliberately not bound: children keep their reserved lineage IDs.
export const schroederPhaseSlotMaterializationWgsl = /* wgsl */ `
struct Params {
  particle_count: u32, lineage_capacity: u32, first_spare: u32, spare_count: u32,
  assignment_count: u32, segment_count: u32, admitted: u32, pad: u32,
  box: vec4<f32>,
};
@group(0) @binding(0) var<storage, read> assignments: array<f32>;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spare_lineages: array<u32>;
@group(0) @binding(5) var<storage, read> segments: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> prepared: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_thermo: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> params: Params;

${PHASE_SLOT_MECHANICS_ACCESSORS_WGSL}

fn finite(v: f32) -> bool { return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u; }
fn finite4(v: vec4<f32>) -> bool { return finite(v.x) && finite(v.y) && finite(v.z) && finite(v.w); }
fn integer(v: f32) -> bool { return finite(v) && v >= 0.0 && v == floor(v); }
fn field(row: u32, column: u32) -> f32 { return assignments[row * 32u + column]; }
fn assignment_active(row: u32) -> bool {
  return params.admitted == 1u && field(row, 3u) > 0.0 && field(row, 3u) < 32.0
    && field(row, 6u) == 1.0;
}
fn source_index(row: u32) -> u32 { return u32(field(row, 0u)); }
fn determinant(i: u32) -> f32 {
  let a = source_mechanics[i * 8u]; let b = source_mechanics[i * 8u + 1u];
  let c = source_mechanics[i * 8u + 2u];
  return a.x * (b.x * c.x - b.y * b.w) - a.y * (a.w * c.x - b.y * b.z)
    + a.z * (a.w * b.w - b.x * b.z);
}
fn source_fluid_lane(i: u32) -> u32 { return i / params.lineage_capacity; }
fn fluid_source(row: u32) -> bool {
  let value = field(row, 0u);
  if (!integer(value) || value >= f32(params.particle_count)) { return false; }
  let i = u32(value);
  // Run after the canonical phase transfer: liquid occupies lane 1 (phase 2)
  // and gas occupies lane 2 (phase 3). Both fluid lanes have solid_flag == 0.
  let lane = source_fluid_lane(i);
  if (lane != 1u && lane != 2u) { return false; }
  let expected_phase = select(3.0, 2.0, lane == 1u);
  let expected_fractions = select(vec4<f32>(0.0, 0.0, 1.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), lane == 1u);
  let s0 = source_state[i * 2u]; let s1 = source_state[i * 2u + 1u];
  let t0 = source_thermo[i * 3u]; let t1 = source_thermo[i * 3u + 1u];
  let t2 = source_thermo[i * 3u + 2u];
  let rep_vol = represented_volume_from_mechanics(i);
  if (!finite4(s0) || !finite4(s1) || !finite4(t0) || !finite4(t2)
      || s0.w <= 0.0 || t0.y != expected_phase || t0.z <= 0.0 || t0.w <= 0.0
      || any(t1 != expected_fractions) || t2.z != 1.0
      || t2.x < 0.0 || t2.y < 0.0 || t2.w < 0.0
      || rep_vol.valid != 1u || !finite(rep_vol.j) || !finite(rep_vol.v0_m3)
      || !finite(rep_vol.current_m3) || !finite(determinant(i))
      || abs(determinant(i) - rep_vol.j) > 2e-4 * max(1.0, rep_vol.j)
      || psm_src_mech_solid_flag(i) != 0.0
      || psm_src_mech_status(i) != 1.0
      || psm_src_mech_constitutive_status(i) != 1.0) { return false; }
  for (var r = 0u; r < 8u; r++) {
    if (!finite4(source_mechanics[i * 8u + r])) { return false; }
  }
  // Reject every competing writer, rather than choosing an order-dependent
  // winner. The production assignment has one row per source.
  for (var other = 0u; other < params.assignment_count; other++) {
    if (other != row && assignment_active(other) && field(other, 0u) == value
        && field(other, 8u) >= 5.0 && field(other, 8u) <= 7.0) { return false; }
  }
  return true;
}
fn empty_lineage(lineage: u32) -> bool {
  if (lineage < params.first_spare || lineage >= params.first_spare + params.spare_count) { return false; }
  for (var lane = 0u; lane < 4u; lane++) {
    let mass = source_state[(lane * params.lineage_capacity + lineage) * 2u].w;
    if (!finite(mass) || mass != 0.0) { return false; }
  }
  return true;
}
fn merge_member(row: u32, group: f32) -> bool {
  if (!assignment_active(row) || field(row, 20u) != group) { return false; }
  let action = field(row, 8u);
  return (action == 6.0 && field(row, 9u) == field(row, 0u) && field(row, 10u) == 1.0
      && field(row, 12u) == 0.0)
    || (action == 7.0 && field(row, 11u) == field(row, 0u) && field(row, 12u) == 1.0);
}
${schroederPhaseSlotCaloricWgsl}
fn reject() { atomicAdd(&evidence[0], 1u); }

// Preparation is read-only with respect to all particle families. A later
// pass consumes these decisions so no merge member races its leader's check.
@compute @workgroup_size(64)
fn prepare(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.assignment_count) { return; }
  for (var k = 0u; k < 8u; k++) { prepared[row * 8u + k] = vec4<f32>(0.0); }
  if (!assignment_active(row)) { return; }
  let action = field(row, 8u);
  if (action != 5.0 && action != 6.0) { return; }
  if (!fluid_source(row)) { reject(); return; }
  let i = source_index(row);
  let leader_lane = source_fluid_lane(i);
  let t0 = source_thermo[i * 3u];
  if (action == 5.0) {
    let rank_value = field(row, 9u); let count_value = field(row, 10u);
    // Denied capacity is an ordinary no-op; no source is retired.
    if (rank_value < 0.0) { return; }
    if (!integer(rank_value) || !integer(count_value) || count_value < 1.0
        || rank_value + count_value > f32(params.spare_count) || field(row, 12u) != 0.0) { reject(); return; }
    let rank = u32(rank_value); let count = u32(count_value);
    let divisor = count_value + 1.0;
    if (!(source_state[i * 2u].w / divisor > 0.0)
        || !(source_mechanics[i * 8u + 4u].w / divisor > 0.0)) { reject(); return; }
    for (var n = 0u; n < count; n++) {
      let lineage = spare_lineages[rank + n];
      if (!empty_lineage(lineage)) { reject(); return; }
      for (var p = 0u; p < n; p++) {
        if (spare_lineages[rank + p] == lineage) { reject(); return; }
      }
    }
    for (var other = 0u; other < params.assignment_count; other++) {
      if (other == row || !assignment_active(other) || field(other, 8u) != 5.0 || field(other, 9u) < 0.0) { continue; }
      let start = field(other, 9u); let end = start + field(other, 10u);
      if (start < rank_value + count_value && end > rank_value) { reject(); return; }
      // Also reject a corrupted rank list that aliases disjoint rank ranges.
      if (integer(start) && integer(end) && end <= f32(params.spare_count)) {
        for (var a = rank; a < rank + count; a++) {
          for (var b = u32(start); b < u32(end); b++) {
            if (spare_lineages[a] == spare_lineages[b]) { reject(); return; }
          }
        }
      }
    }
    let s0 = source_state[i * 2u];
    if (any(s0.xyz < vec3<f32>(0.0)) || any(s0.xyz > params.box.xyz)) { reject(); return; }
    prepared[row * 8u] = vec4<f32>(1.0, f32(i), f32(rank), f32(count));
    return;
  }
  let group = field(row, 20u);
  if (!integer(group) || !merge_member(row, group)) { reject(); return; }
  var mass = 0.0; var moment = vec3<f32>(0.0); var momentum = vec3<f32>(0.0);
  var internal = 0.0; var rest = 0.0; var volume = 0.0; var entities = 0.0;
  var reference_mass = 0.0;
  var members = 0u; var leaders = 0u; var min_source = i;
  var c0 = vec3<f32>(0.0); var c1 = vec3<f32>(0.0); var c2 = vec3<f32>(0.0);
  for (var other = 0u; other < params.assignment_count; other++) {
    if (!merge_member(other, group)) { continue; }
    if (!fluid_source(other)) { reject(); return; }
    let j = source_index(other); let st = source_state[j * 2u]; let vu = source_state[j * 2u + 1u];
    let tt = source_thermo[j * 3u]; let mm = source_mechanics[j * 8u + 4u];
    if (source_fluid_lane(j) != leader_lane || tt.x != t0.x || tt.y != t0.y || tt.w != t0.w
        || source_mechanics[j * 8u + 6u].z != source_mechanics[i * 8u + 6u].z) { reject(); return; }
    mass += st.w; moment += st.w * st.xyz; momentum += st.w * vu.xyz; internal += st.w * vu.w;
    rest += mm.w; volume += mm.z * mm.w; entities += source_thermo[j * 3u + 2u].y;
    reference_mass += source_mechanics[j * 8u + 7u].w;
    c0 += st.w * source_mechanics[j * 8u + 2u].yzw;
    c1 += st.w * source_mechanics[j * 8u + 3u].xyz;
    c2 += st.w * vec3<f32>(source_mechanics[j * 8u + 3u].w, mm.xy);
    min_source = min(min_source, j); members++;
    if (field(other, 8u) == 6.0) { leaders++; }
  }
  if (members < 2u || leaders != 1u || min_source != i || !finite(mass) || mass <= 0.0) { reject(); return; }
  let velocity = momentum / mass;
  // Sum relative kinetic energy directly; subtracting two large bulk kinetic
  // energies would lose this heat under a Galilean velocity shift.
  var heat = 0.0;
  for (var other = 0u; other < params.assignment_count; other++) {
    if (!merge_member(other, group)) { continue; }
    let j = source_index(other); let dv = source_state[j * 2u + 1u].xyz - velocity;
    heat += 0.5 * source_state[j * 2u].w * dot(dv, dv);
  }
  let u = (internal + heat) / mass; let temperature = phase_temperature(t0.x, u, t0.y);
  let position = moment / mass; let j = volume / rest;
  if (!finite4(vec4<f32>(position, mass)) || !finite4(vec4<f32>(velocity, u))
      || !finite4(vec4<f32>(rest, volume, entities, temperature)) || temperature <= 0.0 || !finite(j) || j <= 0.0
      || !finite(reference_mass) || !finite4(vec4<f32>(c0 / mass, 0.0))
      || !finite4(vec4<f32>(c1 / mass, 0.0)) || !finite4(vec4<f32>(c2 / mass, 0.0))
      || any(position < vec3<f32>(0.0)) || any(position > params.box.xyz)) { reject(); return; }
  prepared[row * 8u] = vec4<f32>(1.0, f32(i), f32(members), temperature);
  prepared[row * 8u + 1u] = vec4<f32>(position, mass);
  prepared[row * 8u + 2u] = vec4<f32>(velocity, u);
  prepared[row * 8u + 3u] = vec4<f32>(rest, j, entities, reference_mass);
  prepared[row * 8u + 4u] = vec4<f32>(c0 / mass, 0.0);
  prepared[row * 8u + 5u] = vec4<f32>(c1 / mass, 0.0);
  prepared[row * 8u + 6u] = vec4<f32>(c2 / mass, 0.0);
  prepared[row * 8u + 7u].x = heat;
}

fn copy_mechanics(source: u32, destination: u32) {
  for (var r = 0u; r < 8u; r++) { out_mechanics[destination * 8u + r] = source_mechanics[source * 8u + r]; }
}
fn clear_slot(destination: u32, phase: u32, material: f32) {
  out_state[destination * 2u].w = 0.0;
  out_thermo[destination * 3u].x = material;
  out_thermo[destination * 3u].y = f32(phase);
  out_thermo[destination * 3u + 1u] = vec4<f32>(0.0);
  let old = out_thermo[destination * 3u + 2u];
  out_thermo[destination * 3u + 2u] = vec4<f32>(old.x, 0.0, 254.0, 0.0);
  out_mechanics[destination * 8u + 4u].w = 0.0;
  out_mechanics[destination * 8u + 5u].y = 254.0;
  out_mechanics[destination * 8u + 6u].w = 254.0;
  out_mechanics[destination * 8u + 7u].w = 0.0;
}
fn corner(n: u32, width: u32) -> vec3<f32> {
  // Octets use a cube; larger requests retain unique lattice positions.
  // The centroid is removed before placement, including partial cubes.
  return vec3<f32>(f32(n % width), f32((n / width) % width), f32(n / (width * width)));
}
@compute @workgroup_size(64)
fn materialize(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.assignment_count || !assignment_active(row)) { return; }
  let action = field(row, 8u);
  if (action == 7.0) {
    if (!merge_member(row, field(row, 20u))) { return; }
    for (var leader = 0u; leader < params.assignment_count; leader++) {
      if (field(leader, 8u) == 6.0 && field(leader, 20u) == field(row, 20u)
          && prepared[leader * 8u].x == 1.0) {
        let i = source_index(row);
        clear_slot(i, u32(round(source_thermo[i * 3u].y)), source_thermo[i * 3u].x);
        atomicAdd(&evidence[3], 1u); return;
      }
    }
    return;
  }
  let p = prepared[row * 8u];
  if (p.x != 1.0) { return; }
  let i = u32(p.y); let s0 = source_state[i * 2u]; let t0 = source_thermo[i * 3u];
  if (action == 5.0) {
    let count = u32(p.w) + 1u; let divisor = f32(count);
    let rank = u32(p.z); let old4 = source_mechanics[i * 8u + 4u];
    let scale = pow(1.0 / divisor, 1.0 / 3.0);
    var width = max(1u, u32(ceil(pow(divisor, 1.0 / 3.0))));
    // Correct cube-root rounding at exact integer cubes.
    while (width > 1u && (width - 1u) * (width - 1u) * (width - 1u) >= count) { width--; }
    while (width * width * width < count) { width++; }
    var center = vec3<f32>(0.0); var extent = vec3<f32>(0.0);
    for (var n = 0u; n < count; n++) { center += corner(n, width); }
    center /= divisor;
    for (var n = 0u; n < count; n++) { extent = max(extent, abs(corner(n, width) - center)); }
    var spacing = vec3<f32>(0.5 * pow(old4.z * old4.w / divisor, 1.0 / 3.0));
    spacing = min(spacing, min(s0.xyz, params.box.xyz - s0.xyz) / max(extent, vec3<f32>(1e-20)));
    let source_lane = source_fluid_lane(i);
    for (var n = 0u; n < count; n++) {
      var destination = i;
      if (n > 0u) {
        let lineage = spare_lineages[rank + n - 1u];
        destination = source_lane * params.lineage_capacity + lineage;
        for (var lane = 0u; lane < 4u; lane++) {
          clear_slot(lane * params.lineage_capacity + lineage, lane + 1u, t0.x);
        }
      }
      copy_mechanics(i, destination);
      out_state[destination * 2u] = vec4<f32>(s0.xyz + spacing * (corner(n, width) - center), s0.w / divisor);
      out_state[destination * 2u + 1u] = source_state[i * 2u + 1u];
      out_thermo[destination * 3u] = t0;
      out_thermo[destination * 3u + 1u] = source_thermo[i * 3u + 1u];
      let old2 = source_thermo[i * 3u + 2u];
      out_thermo[destination * 3u + 2u] = vec4<f32>(old2.x * scale, old2.y / divisor, 1.0, old2.w * scale);
      out_mechanics[destination * 8u + 4u].w = old4.w / divisor;
      out_mechanics[destination * 8u + 7u].w = source_mechanics[i * 8u + 7u].w / divisor;
    }
    atomicAdd(&evidence[1], 1u); atomicAdd(&evidence[4], count - 1u); return;
  }
  if (action != 6.0) { return; }
  let merged = prepared[row * 8u + 1u]; let state1 = prepared[row * 8u + 2u];
  let volumes = prepared[row * 8u + 3u];
  out_state[i * 2u] = merged; out_state[i * 2u + 1u] = state1;
  out_thermo[i * 3u].z = p.w;
  let volume_scale = pow(volumes.x / source_mechanics[i * 8u + 4u].w, 1.0 / 3.0);
  let old2 = source_thermo[i * 3u + 2u];
  out_thermo[i * 3u + 2u] = vec4<f32>(old2.x * volume_scale, volumes.z, 1.0, old2.w * volume_scale);
  // Gas has no shear memory. Rescale the source F to the conserved current
  // volume and retain the mass-weighted affine field for the next P2G.
  let fscale = pow(volumes.y / source_mechanics[i * 8u + 4u].z, 1.0 / 3.0);
  out_mechanics[i * 8u] = source_mechanics[i * 8u] * fscale;
  out_mechanics[i * 8u + 1u] = source_mechanics[i * 8u + 1u] * fscale;
  out_mechanics[i * 8u + 2u] = vec4<f32>(source_mechanics[i * 8u + 2u].x * fscale, prepared[row * 8u + 4u].xyz);
  let c1 = prepared[row * 8u + 5u].xyz; let c2 = prepared[row * 8u + 6u].xyz;
  out_mechanics[i * 8u + 3u] = vec4<f32>(c1, c2.x);
  out_mechanics[i * 8u + 4u] = vec4<f32>(c2.yz, volumes.y, volumes.x);
  out_mechanics[i * 8u + 7u].w = volumes.w;
  atomicAdd(&evidence[2], 1u);
}
`;

function uint(value, name, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > 0xffffff) {
    throw new RangeError(`${name} must be an exactly representable nonnegative f32 integer`);
  }
  return value;
}

export function createSchroederPhaseSlotMaterializer(device, {
  lineageCapacity, firstSpareLineage, spareCount, assignmentRowCount,
  thermalMaterialTable, boxDimsM, admissionApproved = false, exactLedger = null
} = {}) {
  const capacity = uint(lineageCapacity, 'lineageCapacity', 1);
  const particleCount = uint(capacity * 4, 'particleCount', 4);
  const first = uint(firstSpareLineage, 'firstSpareLineage');
  const spares = uint(spareCount, 'spareCount', 1);
  const rows = uint(assignmentRowCount, 'assignmentRowCount', 1);
  if (first + spares > capacity) throw new RangeError('Split reserve exceeds the phase-lane stride');
  if (!Array.isArray(boxDimsM) || boxDimsM.length !== 3 || boxDimsM.some(x => !Number.isFinite(x) || !(Math.fround(x) > 0) || !Number.isFinite(Math.fround(x)))) {
    throw new RangeError('Phase-slot materialization requires finite positive box dimensions');
  }
  const segments = thermalMaterialTable?.segments;
  if (!(segments instanceof Float32Array) || segments.length === 0 || segments.length % 12 !== 0) {
    throw new TypeError('Phase-slot materialization requires packed thermal segments');
  }
  if (device.limits.maxStorageBuffersPerShaderStage < 11) {
    throw new RangeError('Phase-slot materialization requires the resident device storage limits');
  }
  const sizes = [particleCount * 32, particleCount * 48, particleCount * 128, rows * 128, segments.byteLength];
  if (sizes.some(bytes => bytes > device.limits.maxBufferSize || bytes > device.limits.maxStorageBufferBindingSize)
      || Math.ceil(rows / 64) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Phase-slot materialization exceeds resident device buffer or dispatch limits');
  }
  const owned = [];
  const transientLeaseScope = createGpuResourceLeaseScope({ scopeId: 'schroeder-phase-slot-materializer' });
  const transientLeases = new Map();
  const make = (label, bytes, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, isTransient = false) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ label: `ulg-phase-slot-${label}`, size: bytes, usage }), device);
    owned.push(b);
    if (isTransient) {
      transientLeases.set(b, transientLeaseScope.issue(b, {
        label: `phase-slot-transient:${label}`,
        producer: 'phase-slot-refinement'
      }));
    }
    return b;
  };
  let ledgerStage = null;
  let destroyed = false;
  let encoded = false;
  const retired = new Set();
  const destroyBuffer = (buffer) => {
    if (!retired.has(buffer)) {
      const lease = transientLeases.get(buffer);
      if (lease) {
        transientLeaseScope.release(lease, { by: 'phase-slot-materializer', allowAlreadyReleased: true });
        transientLeases.delete(buffer);
      }
      buffer.destroy();
      retired.add(buffer);
    }
  };
  const destroy = () => {
    if (destroyed) return;
    ledgerStage?.abandon();
    let firstError = null;
    for (const b of owned) { try { destroyBuffer(b); } catch (error) { firstError ??= error; } }
    if (firstError) throw firstError;
    transientLeaseScope.assertDrained({ requireAllReleased: true });
    destroyed = true;
  };
  try {
    const stateBuffer = make('state', particleCount * 32);
    const thermoBuffer = make('thermo', particleCount * 48);
    const mechanicsBuffer = make('mechanics', particleCount * 128);
    const preparationBuffer = make('preparation', rows * 128, undefined, true);
    const evidenceBuffer = make('evidence', 32);
    const segmentBuffer = make('segments', segments.byteLength, undefined, true);
    device.queue.writeBuffer(segmentBuffer, 0, segments);
    const paramsBuffer = make('params', 48, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, true);
    const params = new ArrayBuffer(48);
    new Uint32Array(params).set([particleCount, capacity, first, spares, rows, segments.length / 12, admissionApproved === true ? 1 : 0, 0]);
    new Float32Array(params).set([...boxDimsM, 0], 8);
    device.queue.writeBuffer(paramsBuffer, 0, params);
    const bindings = Array.from({ length: 12 }, (_, i) => computeBufferBinding(i,
      i === 11 ? 'uniform' : i <= 5 ? 'read-only-storage' : 'storage'));
    const pipelines = ['prepare', 'materialize'].map(entryPoint => createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-phase-slot-materialization-v2-${entryPoint}`, code: schroederPhaseSlotMaterializationWgsl,
      entryPoint, bindings, label: `ulg-phase-slot-${entryPoint}`
    }));
    if (exactLedger) ledgerStage = createSchroederPhaseSlotLedgerStage({ device,
      particleCount, lineageCapacity: capacity, assignmentRowCount: rows, spareCount: spares,
      massRead: exactLedger.massRead, energy: exactLedger.energy,
      preparationBuffer, evidenceBuffer, segmentBuffer, segmentCount: segments.length / 12,
      outStateBuffer: stateBuffer, outThermoBuffer: thermoBuffer, outMechanicsBuffer: mechanicsBuffer });
    return Object.freeze({
      ledgerStage,
      stateBuffer, thermoBuffer, mechanicsBuffer, evidenceBuffer, particleCount,
      admittedParticleCountDelta: 0, identityPreserved: true, requiresConstitutiveRefresh: true,
      destroy,
      cleanupSubmittedWork() {
        for (const buffer of owned) {
          if (![stateBuffer, thermoBuffer, mechanicsBuffer, evidenceBuffer].includes(buffer)) destroyBuffer(buffer);
        }
      },
      destroyOutputParticleBufferComponents(selection = {}) {
        let firstError = null;
        for (const [component, buffer] of Object.entries({ state: stateBuffer, thermo: thermoBuffer, mechanics: mechanicsBuffer })) {
          if (selection[component] === true) {
            try { destroyBuffer(buffer); } catch (error) { firstError ??= error; }
          }
        }
        if ([stateBuffer, thermoBuffer, mechanicsBuffer].every(buffer => retired.has(buffer))) {
          try { destroyBuffer(evidenceBuffer); } catch (error) { firstError ??= error; }
        }
        if (firstError) throw firstError;
        return true;
      },
      encode(encoder, { sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer,
        slotAssignmentBuffer, spareLineagesBuffer }) {
        if (destroyed || encoded || retired.size) throw new Error('Phase-slot candidate is single-use and must remain live through its consumer fence');
        const inputs = [sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, slotAssignmentBuffer, spareLineagesBuffer];
        const bytes = [particleCount * 32, particleCount * 48, particleCount * 128, rows * 128, spares * 4];
        for (let i = 0; i < inputs.length; i++) {
          if (!inputs[i] || inputs[i].size < bytes[i]) throw new RangeError('Phase-slot input buffer is missing or undersized');
        }
        encoded = true;
        encoder.copyBufferToBuffer(sourceStateBuffer, 0, stateBuffer, 0, stateBuffer.size);
        encoder.copyBufferToBuffer(sourceThermoBuffer, 0, thermoBuffer, 0, thermoBuffer.size);
        encoder.copyBufferToBuffer(sourceMechanicsBuffer, 0, mechanicsBuffer, 0, mechanicsBuffer.size);
        const buffers = [slotAssignmentBuffer, sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer,
          spareLineagesBuffer, segmentBuffer, preparationBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, evidenceBuffer, paramsBuffer];
        const group = createCachedExplicitBindGroup(device, { layout: pipelines[0].bindGroupLayout,
          entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
        for (const [index, p] of pipelines.entries()) {
          const pass = encoder.beginComputePass({ label: p.label });
          pass.setPipeline(p.pipeline); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(Math.ceil(rows / 64)); pass.end();
          if (index === 0) ledgerStage?.encodePrepare(encoder, { slotAssignmentBuffer,
            spareLineagesBuffer, sourceThermoBuffer });
        }
        ledgerStage?.encodeProject(encoder);
      }
    });
  } catch (error) { destroy(); throw error; }
}
