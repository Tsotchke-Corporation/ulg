import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { pressureCarrierTransformWgsl } from '../../../ulg-gpu-abi/src/pressureCarrierTransformWgsl.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from './sphMechanicsMaterialTable.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import {
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';

export const ULG_SPH_PHASE_CARRIER_TRANSFER_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-transfer.v2';
const phaseCarrierTransferCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'sph-phase-carrier-transfer-submitted-work'
  });
const phaseCarrierOutputCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'sph-phase-carrier-output'
  });
export const ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-plan.v2';
export const SPH_PHASE_FRACTION_VALIDATION_EPSILON = 1e-7;
export const SPH_PHASE_COMPONENT_ACTIVATION_EPSILON = 0;

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const PHASE_TRANSFER_EVIDENCE_MAGIC = 0x50544631;
const PHASE_TRANSFER_EVIDENCE_VERSION = 1;
const PHASE_COMPANION_RESERVED_STATUS = 254;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function validateSphPhaseCarrierPlan(plan, particleCount, {
  allowLawsQuiescentSingleLane = false
} = {}) {
  const rawParticleCount = Number(particleCount);
  const particleCountValid = Number.isSafeInteger(rawParticleCount)
    && rawParticleCount > 0;
  const count = particleCountValid ? rawParticleCount : 0;
  const lineageCapacity = Number(plan?.lineageCapacity);
  const primaryCapacity = Number(plan?.primaryCapacity);
  const phaseLaneCount = Number(plan?.phaseLaneCount);
  const phaseLaneStride = Number(plan?.phaseLaneStride);
  const companionStart = Number(plan?.companionStart);
  const companionCapacity = Number(plan?.companionCapacity);
  const particleCapacity = Number(plan?.particleCapacity);
  const fixedFourLanePlan = phaseLaneCount === 4
    && phaseLaneStride === lineageCapacity
    && companionStart === lineageCapacity
    && companionCapacity === lineageCapacity * (phaseLaneCount - 1)
    && lineageCapacity * phaseLaneCount === count;
  const lawsQuiescentSingleLanePlan = allowLawsQuiescentSingleLane === true
    && phaseLaneCount === 1
    && phaseLaneStride === lineageCapacity
    && companionStart === lineageCapacity
    && companionCapacity === 0
    && lineageCapacity === count
    && plan?.phaseCompanionLanesRequired === false;
  const accepted = plan?.schema === ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA
    && particleCountValid
    && plan?.status === 'phase-lane-capacity-ready'
    && Number.isSafeInteger(lineageCapacity)
    && lineageCapacity > 0
    && Number.isSafeInteger(primaryCapacity)
    && primaryCapacity === lineageCapacity
    && Number.isSafeInteger(phaseLaneCount)
    && Number.isSafeInteger(phaseLaneStride)
    && Number.isSafeInteger(companionStart)
    && Number.isSafeInteger(companionCapacity)
    && Number.isSafeInteger(particleCapacity)
    && particleCapacity === count
    && (fixedFourLanePlan || lawsQuiescentSingleLanePlan);
  if (!accepted) {
    return {
      accepted: false,
      status: 'phase-carrier-plan-rejected',
      lineageCapacity: 0,
      primaryCapacity: 0,
      phaseLaneCount: 0,
      phaseLaneStride: 0,
      companionStart: 0,
      companionCapacity: 0,
      particleCapacity: count
    };
  }
  return {
    accepted: true,
    status: 'phase-carrier-plan-admitted',
    lineageCapacity,
    primaryCapacity,
    phaseLaneCount,
    phaseLaneStride,
    companionStart,
    companionCapacity,
    particleCapacity
  };
}

function assertInputs({
  sphParticleState,
  mlsMpmParticleState,
  thermalMaterialTable,
  mechanicsMaterialTable,
  phaseCarrierPlan
}) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Phase-carrier transfer requires a packed SPH particle state');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Phase-carrier transfer requires a packed MLS-MPM particle state');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('Phase-carrier transfer requires matching particle counts');
  }
  if (!(thermalMaterialTable?.segments instanceof Float32Array)) {
    throw new TypeError('Phase-carrier transfer requires a packed thermal segment table');
  }
  // The material records carry the pressure-adjusted carrier law (lanes 5-7).
  // Without them a plateau cannot be pressure-shifted at all, so refuse rather
  // than silently resolving every particle on the reference ladder.
  if (!(thermalMaterialTable?.records instanceof Float32Array)) {
    throw new TypeError(
      'Phase-carrier transfer requires packed thermal material records for the pressure carrier law'
    );
  }
  if (mechanicsMaterialTable?.schema !== ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Phase-carrier transfer requires a mechanics material table');
  }
  const admitted = validateSphPhaseCarrierPlan(
    phaseCarrierPlan || sphParticleState.phaseCarrierPlan,
    sphParticleState.particleCount
  );
  if (!admitted.accepted) {
    throw new RangeError('Phase-carrier transfer rejected an invalid fixed phase-lane plan');
  }
  return admitted;
}

function createStorageBuffer(device, label, byteLength, extraUsage = 0) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | extraUsage
  }), device);
}

function uploadStorageBuffer(device, label, values, extraUsage = 0) {
  const buffer = createStorageBuffer(
    device,
    label,
    values.byteLength,
    GPU_BUFFER_USAGE.COPY_DST | extraUsage
  );
  if (values.byteLength > 0) device.queue.writeBuffer(buffer, 0, values);
  return buffer;
}

function createClosureRows(thermalMaterialTable, mechanicsMaterialTable) {
  const thermalSegments = thermalMaterialTable.segments;
  const mechanicsRecords = mechanicsMaterialTable.records;
  // The thermal material records ride along so the shader can resolve each
  // material's pressure-adjusted carrier law (lanes 5-7) without a fourth
  // storage binding. Stride 8 floats = 2 vec4 per record.
  const materialRecords = thermalMaterialTable.records;
  const values = new Float32Array(
    thermalSegments.length + mechanicsRecords.length + materialRecords.length
  );
  values.set(thermalSegments, 0);
  values.set(mechanicsRecords, thermalSegments.length);
  values.set(materialRecords, thermalSegments.length + mechanicsRecords.length);
  return {
    values,
    thermalSegmentCount: Math.floor(thermalSegments.length / 12),
    mechanicsRecordCount: Math.floor(mechanicsRecords.length / 12),
    materialRecordCount: Math.floor(materialRecords.length / 8),
    thermalOffsetVec4: 0,
    mechanicsOffsetVec4: Math.floor(thermalSegments.length / 4),
    materialRecordOffsetVec4:
      Math.floor((thermalSegments.length + mechanicsRecords.length) / 4)
  };
}

function createParamsArray({
  particleCount,
  plan,
  closure,
  absolutePressureAuthority = false
}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, plan.lineageCapacity, true);
  view.setUint32(8, plan.phaseLaneCount, true);
  view.setUint32(12, plan.phaseLaneStride, true);
  view.setUint32(16, closure.thermalSegmentCount, true);
  view.setUint32(20, closure.mechanicsRecordCount, true);
  view.setUint32(24, closure.thermalOffsetVec4, true);
  view.setUint32(28, closure.mechanicsOffsetVec4, true);
  view.setUint32(32, PHASE_COMPANION_RESERVED_STATUS, true);
  view.setFloat32(36, SPH_PHASE_FRACTION_VALIDATION_EPSILON, true);
  view.setFloat32(40, 2e-4, true);
  view.setFloat32(44, 1e-20, true);
  view.setUint32(48, closure.materialRecordCount, true);
  view.setUint32(52, closure.materialRecordOffsetVec4, true);
  view.setUint32(56, absolutePressureAuthority === true ? 1 : 0, true);
  view.setFloat32(60, SPH_PHASE_COMPONENT_ACTIVATION_EPSILON, true);
  return buffer;
}

function initialEvidence(primaryCapacity) {
  return new Uint32Array([
    PHASE_TRANSFER_EVIDENCE_MAGIC,
    PHASE_TRANSFER_EVIDENCE_VERSION,
    0, // error bits
    0, // valid lineages
    0, // multi-phase lineages
    0, // transferred lineages
    0, // rejected lineages
    0xffffffff, // first rejected lineage
    0, 0, 0, 0, 0, 0, 0, 0
  ]);
}

export const sphPhaseCarrierTransferWgsl = /* wgsl */ `
${pressureCarrierTransformWgsl}
struct PhaseTransferParams {
  particle_count: u32,
  lineage_capacity: u32,
  phase_lane_count: u32,
  phase_lane_stride: u32,
  thermal_segment_count: u32,
  mechanics_record_count: u32,
  thermal_offset_vec4: u32,
  mechanics_offset_vec4: u32,
  reserved_status: u32,
  fraction_validation_epsilon: f32,
  relative_tolerance: f32,
  mass_epsilon: f32,
  material_record_count: u32,
  material_record_offset_vec4: u32,
  // Nonzero only when the host declares that mechanics lane 28 holds a real
  // absolute pressure. It does not by default: the host currently packs a
  // depth-derived hydrostatic *gauge* prestress there, and reading a gauge
  // value as absolute would put deep water at a few kPa absolute and boil it.
  // While this is zero the pressure plateau fails closed and every particle
  // resolves on the reference ladder, which is the pre-Slice-9 behavior.
  absolute_pressure_authority: u32,
  fraction_activation_epsilon: f32,
};

struct LineagePhases {
  phase_mask: u32,
  count: u32,
  valid: u32,
  error_bits: u32,
  material_id: f32,
};

struct PhaseAggregate {
  mass: f32,
  current_volume: f32,
  first_moment: vec3<f32>,
  momentum: vec3<f32>,
  internal_energy: f32,
  source_kinetic_energy: f32,
  temperature_mass: f32,
  smoothing_length: f32,
  entity_count: f32,
  radius_cubed: f32,
  template_index: u32,
  template_component_mass: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: PhaseTransferParams;

const EVIDENCE_MAGIC: u32 = 0x50544631u;
const EVIDENCE_VERSION: u32 = 1u;
const ERROR_LAYOUT: u32 = 1u;
const ERROR_NONFINITE: u32 = 2u;
const ERROR_MATERIAL: u32 = 4u;
const ERROR_FRACTION: u32 = 8u;
const ERROR_PHASE_COUNT: u32 = 16u;
const ERROR_PLATEAU: u32 = 32u;
const ERROR_ENERGY: u32 = 64u;
const ERROR_MECHANICS: u32 = 128u;
const ERROR_VOLUME: u32 = 256u;
const INVALID_INDEX: u32 = 0xffffffffu;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn nearly_equal(a: f32, b: f32) -> bool {
  return abs(a - b) <= params.relative_tolerance * max(1.0, max(abs(a), abs(b)));
}

fn state0(index: u32) -> vec4<f32> { return source_state[index * 2u]; }
fn state1(index: u32) -> vec4<f32> { return source_state[index * 2u + 1u]; }
fn thermo0(index: u32) -> vec4<f32> { return source_thermo[index * 3u]; }
fn thermo1(index: u32) -> vec4<f32> { return source_thermo[index * 3u + 1u]; }
fn thermo2(index: u32) -> vec4<f32> { return source_thermo[index * 3u + 2u]; }

fn phase_lane_index(lineage_index: u32, phase_id: u32) -> u32 {
  return (phase_id - 1u) * params.phase_lane_stride + lineage_index;
}

// Resolve the pressure-adjusted plateau for this material's liquid-to-gas
// segment at the particle's resolved absolute pressure.
//
// Away from the reference pressure the plateau that actually contains the
// particle's physical energy is [E0*, E1*], not the packed [E0, E1]; searching
// the reference ladder directly would simply fail to recognize a boiling
// particle. Instead the particle's energy is mapped into reference-carrier
// space, the existing reference search runs unchanged, and the endpoint it
// returns is mapped back to physical energy.
//
// A material with no admitted plateau, or a nonpositive/nonfinite pressure,
// yields valid = 0 and the caller keeps the untransformed reference path.
fn carrier_plateau_for(material_id: f32, absolute_pressure_pa: f32) -> UlgPressurePlateau {
  // Refuse to interpret the pressure lane at all until the host says it is an
  // absolute pressure. There is deliberately no fallback to one atmosphere.
  if (params.absolute_pressure_authority == 0u) {
    return ulg_pressure_plateau_invalid();
  }
  var law_id = 0u;
  var reference_pressure_pa = 0.0;
  var log_slope = 0.0;
  var found = false;
  for (var record = 0u; record < params.material_record_count; record = record + 1u) {
    let base = params.material_record_offset_vec4 + record * 2u;
    let row0 = closure_rows[base];
    if (row0.x == material_id) {
      let row1 = closure_rows[base + 1u];
      law_id = u32(round(row1.y));
      reference_pressure_pa = row1.z;
      log_slope = row1.w;
      found = true;
      break;
    }
  }
  if (!found || law_id != ULG_PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU) {
    return ulg_pressure_plateau_invalid();
  }

  // Locate the packed liquid-to-gas plateau and the liquid branch that feeds
  // it. The anchor is the phase segment ending exactly where the plateau
  // starts, which is what makes cp = (E0-Ea)/(Tref-Ta) the liquid branch's
  // mean heat capacity rather than an unrelated slope.
  var plateau_start = 0.0;
  var plateau_end = 0.0;
  var reference_temperature_k = 0.0;
  var plateau_found = false;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    if (
      row0.x == material_id
      && abs(row0.y - 2.0) < 0.5
      && u32(round(row0.z)) == 2u
      && u32(round(row0.w)) == 3u
    ) {
      let row1 = closure_rows[base + 1u];
      plateau_start = row1.x;
      plateau_end = row1.y;
      reference_temperature_k = row1.z;
      plateau_found = true;
      break;
    }
  }
  if (!plateau_found) { return ulg_pressure_plateau_invalid(); }

  var anchor_energy = 0.0;
  var anchor_temperature_k = 0.0;
  var anchor_found = false;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row0.x == material_id
      && abs(row0.y - 1.0) < 0.5
      && row1.y == plateau_start
    ) {
      anchor_energy = row1.x;
      anchor_temperature_k = row1.z;
      anchor_found = true;
      break;
    }
  }
  if (!anchor_found) { return ulg_pressure_plateau_invalid(); }

  return ulg_resolve_pressure_plateau_with_slope(
    anchor_energy,
    anchor_temperature_k,
    plateau_start,
    plateau_end,
    reference_temperature_k,
    absolute_pressure_pa,
    reference_pressure_pa,
    log_slope
  );
}

fn plateau_endpoint(
  material_id: f32,
  phase0: u32,
  phase1: u32,
  source_u: f32,
  target_phase: u32,
  absolute_pressure_pa: f32
) -> vec2<f32> {
  // Reference-carrier space. At the reference pressure this is bitwise the
  // untransformed energy, so the search below is unchanged.
  let plateau = carrier_plateau_for(material_id, absolute_pressure_pa);
  let carrier_u = ulg_carrier_from_physical_energy(plateau, source_u);
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row0.x == material_id
      && abs(row0.y - 2.0) < 0.5
      && u32(round(row0.z)) == phase0
      && u32(round(row0.w)) == phase1
      && carrier_u >= row1.x - params.relative_tolerance * max(1.0, abs(row1.x))
      && carrier_u <= row1.y + params.relative_tolerance * max(1.0, abs(row1.y))
    ) {
      if (target_phase == phase0) {
        return vec2<f32>(ulg_physical_energy_from_carrier(plateau, row1.x), 1.0);
      }
      if (target_phase == phase1) {
        return vec2<f32>(ulg_physical_energy_from_carrier(plateau, row1.y), 1.0);
      }
    }
  }
  return vec2<f32>(0.0, 0.0);
}

fn mechanics_record_index(material_id: f32, phase_id: u32) -> u32 {
  for (var record = 0u; record < params.mechanics_record_count; record = record + 1u) {
    let row0 = closure_rows[params.mechanics_offset_vec4 + record * 3u];
    if (row0.x == material_id && u32(round(row0.y)) == phase_id) {
      return record;
    }
  }
  return INVALID_INDEX;
}

fn lineage_phases(lineage_index: u32) -> LineagePhases {
  var phase_set = LineagePhases(0u, 0u, 1u, 0u, 0.0);
  for (var source_phase = 1u; source_phase <= 4u; source_phase = source_phase + 1u) {
    let source_index = phase_lane_index(lineage_index, source_phase);
    let s0 = state0(source_index);
    let s1 = state1(source_index);
    if (!(s0.w > params.mass_epsilon)) { continue; }
    let t0 = thermo0(source_index);
    let fractions = thermo1(source_index);
    let mechanics_row4 = source_mechanics[source_index * 8u + 4u];
    let current_volume = mechanics_row4.z * mechanics_row4.w;
    if (
      !finite_f32(s0.x) || !finite_f32(s0.y) || !finite_f32(s0.z)
      || !finite_f32(s0.w) || !finite_f32(s1.x) || !finite_f32(s1.y)
      || !finite_f32(s1.z) || !finite_f32(s1.w) || !finite_f32(t0.x)
      || t0.x < 1.0 || t0.x > 16777215.0
    ) {
      phase_set.valid = 0u;
      phase_set.error_bits = phase_set.error_bits | ERROR_NONFINITE;
      return phase_set;
    }
    if (
      !finite_f32(mechanics_row4.z)
      || !finite_f32(mechanics_row4.w)
      || !finite_f32(current_volume)
      || !(mechanics_row4.z > 0.0)
      || !(mechanics_row4.w > 0.0)
      || !(current_volume > 0.0)
    ) {
      phase_set.valid = 0u;
      phase_set.error_bits = phase_set.error_bits | ERROR_VOLUME;
      return phase_set;
    }
    if (phase_set.material_id == 0.0) {
      phase_set.material_id = t0.x;
    } else if (phase_set.material_id != t0.x) {
      phase_set.valid = 0u;
      phase_set.error_bits = phase_set.error_bits | ERROR_MATERIAL;
      return phase_set;
    }
    var fraction_sum = 0.0;
    var positive_count = 0u;
    var local_phase0 = 0u;
    var local_phase1 = 0u;
    for (var lane = 0u; lane < 4u; lane = lane + 1u) {
      let fraction = fractions[lane];
      if (!finite_f32(fraction) || fraction < -params.fraction_validation_epsilon || fraction > 1.0 + params.fraction_validation_epsilon) {
        phase_set.valid = 0u;
        phase_set.error_bits = phase_set.error_bits | ERROR_FRACTION;
        return phase_set;
      }
      fraction_sum = fraction_sum + max(fraction, 0.0);
      if (fraction > params.fraction_activation_epsilon) {
        let phase_id = lane + 1u;
        let phase_bit = 1u << (phase_id - 1u);
        if ((phase_set.phase_mask & phase_bit) == 0u) {
          phase_set.phase_mask = phase_set.phase_mask | phase_bit;
          phase_set.count = phase_set.count + 1u;
        }
        if (positive_count == 0u) { local_phase0 = phase_id; }
        if (positive_count == 1u) { local_phase1 = phase_id; }
        positive_count = positive_count + 1u;
      }
    }
    if (!nearly_equal(fraction_sum, 1.0) || positive_count == 0u || positive_count > 2u) {
      phase_set.valid = 0u;
      phase_set.error_bits = phase_set.error_bits | ERROR_FRACTION | ERROR_PHASE_COUNT;
      return phase_set;
    }
    if (positive_count == 2u) {
      if (local_phase1 < local_phase0) {
        let swap = local_phase0;
        local_phase0 = local_phase1;
        local_phase1 = swap;
      }
      let absolute_pressure_pa = source_mechanics[source_index * 8u + 7u].x;
      let e0 = plateau_endpoint(
        t0.x, local_phase0, local_phase1, s1.w, local_phase0, absolute_pressure_pa
      );
      let e1 = plateau_endpoint(
        t0.x, local_phase0, local_phase1, s1.w, local_phase1, absolute_pressure_pa
      );
      if (e0.y == 0.0 || e1.y == 0.0) {
        phase_set.valid = 0u;
        phase_set.error_bits = phase_set.error_bits | ERROR_PLATEAU;
        return phase_set;
      }
      let reconstructed = fractions[local_phase0 - 1u] * e0.x
        + fractions[local_phase1 - 1u] * e1.x;
      if (!nearly_equal(reconstructed, s1.w)) {
        phase_set.valid = 0u;
        phase_set.error_bits = phase_set.error_bits | ERROR_ENERGY;
        return phase_set;
      }
    }
  }
  return phase_set;
}

fn source_component_energy(source_index: u32, target_phase: u32) -> vec2<f32> {
  let s1 = state1(source_index);
  let t0 = thermo0(source_index);
  let fractions = thermo1(source_index);
  var positive_count = 0u;
  var local_phase0 = 0u;
  var local_phase1 = 0u;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    if (fractions[lane] > params.fraction_activation_epsilon) {
      let phase_id = lane + 1u;
      if (positive_count == 0u) { local_phase0 = phase_id; }
      if (positive_count == 1u) { local_phase1 = phase_id; }
      positive_count = positive_count + 1u;
    }
  }
  if (positive_count == 1u && local_phase0 == target_phase) {
    return vec2<f32>(s1.w, 1.0);
  }
  if (positive_count == 2u) {
    if (local_phase1 < local_phase0) {
      let swap = local_phase0;
      local_phase0 = local_phase1;
      local_phase1 = swap;
    }
    // Mechanics lane 28 is the particle's resolved absolute pressure; a
    // nonpositive or nonfinite value fails the plateau closed rather than
    // silently standing in for one atmosphere.
    let absolute_pressure_pa = source_mechanics[source_index * 8u + 7u].x;
    return plateau_endpoint(
      t0.x, local_phase0, local_phase1, s1.w, target_phase, absolute_pressure_pa
    );
  }
  return vec2<f32>(0.0, 0.0);
}

fn phase_aggregate(
  lineage_index: u32,
  target_phase: u32
) -> PhaseAggregate {
  var aggregate = PhaseAggregate(
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    phase_lane_index(lineage_index, target_phase),
    -1.0
  );
  for (var source_phase = 1u; source_phase <= 4u; source_phase = source_phase + 1u) {
    let source_index = phase_lane_index(lineage_index, source_phase);
    let s0 = state0(source_index);
    if (!(s0.w > params.mass_epsilon)) { continue; }
    let s1 = state1(source_index);
    let t0 = thermo0(source_index);
    let fractions = thermo1(source_index);
    let t2 = thermo2(source_index);
    let fraction = max(fractions[target_phase - 1u], 0.0);
    if (!(fraction > params.fraction_activation_epsilon)) { continue; }
    let component_mass = s0.w * fraction;
    let mechanics_row4 = source_mechanics[source_index * 8u + 4u];
    let component_current_volume = mechanics_row4.z * mechanics_row4.w * fraction;
    let component_energy = source_component_energy(source_index, target_phase).x;
    aggregate.mass = aggregate.mass + component_mass;
    aggregate.current_volume = aggregate.current_volume + component_current_volume;
    aggregate.first_moment = aggregate.first_moment + s0.xyz * component_mass;
    aggregate.momentum = aggregate.momentum + s1.xyz * component_mass;
    aggregate.internal_energy = aggregate.internal_energy + component_energy * component_mass;
    aggregate.source_kinetic_energy = aggregate.source_kinetic_energy
      + 0.5 * component_mass * dot(s1.xyz, s1.xyz);
    aggregate.temperature_mass = aggregate.temperature_mass + t0.z * component_mass;
    aggregate.smoothing_length = max(aggregate.smoothing_length, max(t2.x, 0.0));
    aggregate.entity_count = aggregate.entity_count + max(t2.y, 0.0) * fraction;
    aggregate.radius_cubed = aggregate.radius_cubed + pow(max(t2.w, 0.0), 3.0) * fraction;
    if (component_mass > aggregate.template_component_mass) {
      aggregate.template_component_mass = component_mass;
      aggregate.template_index = source_index;
    }
  }
  return aggregate;
}

fn copy_lineage(lineage_index: u32) {
  for (var phase_id = 1u; phase_id <= 4u; phase_id = phase_id + 1u) {
    let index = phase_lane_index(lineage_index, phase_id);
    out_state[index * 2u] = source_state[index * 2u];
    out_state[index * 2u + 1u] = source_state[index * 2u + 1u];
    out_thermo[index * 3u] = source_thermo[index * 3u];
    out_thermo[index * 3u + 1u] = source_thermo[index * 3u + 1u];
    out_thermo[index * 3u + 2u] = source_thermo[index * 3u + 2u];
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_mechanics[index * 8u + row] = source_mechanics[index * 8u + row];
    }
  }
}

fn one_hot(phase_id: u32) -> vec4<f32> {
  return vec4<f32>(
    select(0.0, 1.0, phase_id == 1u),
    select(0.0, 1.0, phase_id == 2u),
    select(0.0, 1.0, phase_id == 3u),
    select(0.0, 1.0, phase_id == 4u)
  );
}

fn mechanics_model_matches_target(
  source_index: u32,
  target_solid: f32,
  target_eos_model: f32
) -> bool {
  let source_base = source_index * 8u;
  let source_row5 = source_mechanics[source_base + 5u];
  let source_row6 = source_mechanics[source_base + 6u];
  return abs(source_row5.x - target_solid) < 0.5
    && abs(source_row6.z - target_eos_model) < 0.5
    && source_row5.y == 1.0
    && source_row6.w == 1.0;
}

fn write_phase_slot(
  target_index: u32,
  target_phase: u32,
  phases: LineagePhases,
  aggregate: PhaseAggregate
) {
  let mechanics_record = mechanics_record_index(phases.material_id, target_phase);
  let record_base = params.mechanics_offset_vec4 + mechanics_record * 3u;
  let record0 = closure_rows[record_base];
  let record1 = closure_rows[record_base + 1u];
  let record2 = closure_rows[record_base + 2u];
  // Preserve deformation from the largest actual contributor to this phase,
  // not merely from whichever fixed slot now owns it. The phase pair changes
  // roles at solid/liquid/gas boundaries, so slot-local mechanics can belong
  // to the previous constitutive model (for example gas J=1000 moving into a
  // liquid slot). A model mismatch starts the target phase at its own
  // reference configuration instead of importing an incompatible F/J state.
  let template_index = aggregate.template_index;
  let template_source_mass = state0(template_index).w;
  let template_source_fraction = thermo1(template_index)[target_phase - 1u];
  let preserve_deformation = template_source_mass > params.mass_epsilon
    && template_source_fraction > params.fraction_activation_epsilon
    && mechanics_model_matches_target(template_index, record2.x, record1.w);
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[target_index * 8u + row] = source_mechanics[template_index * 8u + row];
  }

  let inv_mass = 1.0 / aggregate.mass;
  let position = aggregate.first_moment * inv_mass;
  let velocity = aggregate.momentum * inv_mass;
  let merged_kinetic_energy = 0.5 * aggregate.mass * dot(velocity, velocity);
  let thermalized_kinetic_energy = max(
    aggregate.source_kinetic_energy - merged_kinetic_energy,
    0.0
  );
  let specific_energy = (aggregate.internal_energy + thermalized_kinetic_energy) * inv_mass;
  let temperature = aggregate.temperature_mass * inv_mass;
  // A phase component materializes in its own phase's rest state.
  //
  // The tempting alternative -- carry the source's represented current volume
  // across the split so Vcurrent = V0 * J is conserved through the transfer --
  // is wrong precisely where it matters. It derives V0 as mass/rho_rest for the
  // TARGET phase while taking J from the SOURCE's current volume, so a
  // liquid-to-gas split writes J of about 1/1667 into F as diag(J^(1/3)) and
  // leaves the new gas sitting at liquid density. The EOS then sees very
  // nearly the full liquid/gas density ratio as overpressure, which an
  // explicit step cannot resolve. Measured on iron-ice-quench that drove the
  // water to 78 m/s and collapsed J to 8.7e-4.
  //
  // Conserving the volume is not the more physical choice here either. When
  // water flashes to steam the vapour expands by that same ratio; asserting
  // that a gas component still occupies its liquid volume is the less physical
  // state, not the more careful one. The expansion is sub-resolution, so the
  // component is materialized already relaxed to its phase's rest volume and
  // the volume change is that expansion.
  //
  // A conditional form of this -- conserve when the conserved density is close
  // to the phase's rest density, fall back otherwise -- was tried and is worse:
  // the predicate flips between steps for the same lineage, and the resulting
  // V0 flapping pumped energy in, holding the scenario near 100 m/s.
  let rest_volume = aggregate.mass / max(record0.z, params.mass_epsilon);
  let volume_ratio_j = 1.0;
  let isotropic_scale = 1.0;
  out_state[target_index * 2u] = vec4<f32>(position, aggregate.mass);
  out_state[target_index * 2u + 1u] = vec4<f32>(velocity, specific_energy);
  out_thermo[target_index * 3u] = vec4<f32>(
    phases.material_id,
    f32(target_phase),
    temperature,
    record0.z
  );
  out_thermo[target_index * 3u + 1u] = one_hot(target_phase);
  out_thermo[target_index * 3u + 2u] = vec4<f32>(
    aggregate.smoothing_length,
    aggregate.entity_count,
    1.0,
    pow(max(aggregate.radius_cubed, 0.0), 1.0 / 3.0)
  );
  if (!preserve_deformation) {
    out_mechanics[target_index * 8u] = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    out_mechanics[target_index * 8u + 1u] = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    out_mechanics[target_index * 8u + 2u] = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    out_mechanics[target_index * 8u + 3u] = vec4<f32>(0.0);
    out_mechanics[target_index * 8u + 4u] = vec4<f32>(
      0.0,
      0.0,
      volume_ratio_j,
      rest_volume
    );
  } else {
    // This branch is NOT a materialization. preserve_deformation already
    // required that the template carries real mass in the target phase and that
    // mechanics_model_matches_target, so the component is continuing in the
    // same constitutive model rather than being created in a new one. The
    // 1667x trap the block above documents cannot fire here: J is the
    // template's own J for its own phase, never a cross-phase volume ratio, and
    // it is not derived from aggregate.current_volume.
    //
    // Writing the materialization's volume_ratio_j (a hard 1.0) here instead
    // renormalized every continuing particle back to zero volumetric strain
    // once per step. Measured on the h2o drop scenario: J came back bit-exactly
    // 1.0 for all 152 liquid particles while dt*div(v) reached 9.4e-4 and
    // trace(C) reached -1.9 /s, so the strain was being erased as fast as the
    // G2P produced it. With density then pinned to rest density, the Tait EOS
    // returned exactly zero gauge pressure and resolvedAbsolutePressurePa
    // collapsed to a flat 101325 Pa -- no hydrostatic gradient at all, and so
    // no buoyancy for a generated gas cohort to rise on.
    //
    // V0 still retracks to the target's rest volume: V0 follows mass, J carries
    // strain, and current volume is their product.
    let template_row0 = out_mechanics[target_index * 8u];
    let template_row1 = out_mechanics[target_index * 8u + 1u];
    let template_row2 = out_mechanics[target_index * 8u + 2u];
    let old4 = out_mechanics[target_index * 8u + 4u];
    let preserved_volume_ratio_j = max(old4.z, params.mass_epsilon);
    out_mechanics[target_index * 8u] = template_row0;
    out_mechanics[target_index * 8u + 1u] = template_row1;
    out_mechanics[target_index * 8u + 2u] = template_row2;
    out_mechanics[target_index * 8u + 4u] = vec4<f32>(
      old4.xy,
      preserved_volume_ratio_j,
      rest_volume
    );
  }
  out_mechanics[target_index * 8u + 5u] = vec4<f32>(record2.x, record2.y, record0.w, record1.x);
  out_mechanics[target_index * 8u + 6u] = vec4<f32>(record1.y, record1.z, record1.w, record2.y);
  let old7 = out_mechanics[target_index * 8u + 7u];
  out_mechanics[target_index * 8u + 7u] = vec4<f32>(
    old7.x,
    record2.z,
    record2.w,
    aggregate.mass
  );
}

fn clear_phase_slot(target_index: u32, target_phase: u32, material_id: f32) {
  let source_s0 = state0(target_index);
  let source_s1 = state1(target_index);
  let source_t0 = thermo0(target_index);
  let source_t2 = thermo2(target_index);
  out_state[target_index * 2u] = vec4<f32>(source_s0.xyz, 0.0);
  out_state[target_index * 2u + 1u] = source_s1;
  out_thermo[target_index * 3u] = vec4<f32>(
    material_id,
    f32(target_phase),
    source_t0.z,
    source_t0.w
  );
  out_thermo[target_index * 3u + 1u] = vec4<f32>(0.0);
  out_thermo[target_index * 3u + 2u] = vec4<f32>(
    source_t2.x,
    0.0,
    f32(params.reserved_status),
    0.0
  );
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[target_index * 8u + row] = source_mechanics[target_index * 8u + row];
  }
  out_mechanics[target_index * 8u + 4u].w = 0.0;
  out_mechanics[target_index * 8u + 5u].y = f32(params.reserved_status);
  out_mechanics[target_index * 8u + 6u].w = f32(params.reserved_status);
  out_mechanics[target_index * 8u + 7u].w = 0.0;
}

fn lineage_mechanics_valid(phases: LineagePhases) -> bool {
  for (var phase_id = 1u; phase_id <= 4u; phase_id = phase_id + 1u) {
    let phase_bit = 1u << (phase_id - 1u);
    if ((phases.phase_mask & phase_bit) != 0u
        && mechanics_record_index(phases.material_id, phase_id) == INVALID_INDEX) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(64)
fn preflight(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let lineage_index = global_id.x;
  if (lineage_index >= params.lineage_capacity) { return; }
  if (
    params.phase_lane_count != 4u
    || params.phase_lane_stride != params.lineage_capacity
    || params.particle_count != params.lineage_capacity * params.phase_lane_count
    || arrayLength(&source_state) < params.particle_count * 2u
    || arrayLength(&source_thermo) < params.particle_count * 3u
    || arrayLength(&source_mechanics) < params.particle_count * 8u
    || arrayLength(&out_state) < params.particle_count * 2u
    || arrayLength(&out_thermo) < params.particle_count * 3u
    || arrayLength(&out_mechanics) < params.particle_count * 8u
    || arrayLength(&evidence) < 16u
    || atomicLoad(&evidence[0u]) != EVIDENCE_MAGIC
    || atomicLoad(&evidence[1u]) != EVIDENCE_VERSION
  ) {
    atomicOr(&evidence[2u], ERROR_LAYOUT);
    return;
  }
  let phases = lineage_phases(lineage_index);
  if (phases.valid == 0u) {
    atomicOr(&evidence[2u], phases.error_bits);
    atomicAdd(&evidence[6u], 1u);
    atomicMin(&evidence[7u], lineage_index);
    return;
  }
  if (phases.count > 0u && !lineage_mechanics_valid(phases)) {
    atomicOr(&evidence[2u], ERROR_MECHANICS);
    atomicAdd(&evidence[6u], 1u);
    atomicMin(&evidence[7u], lineage_index);
    return;
  }
  if (phases.count > 1u) {
    atomicAdd(&evidence[4u], 1u);
  }
  atomicAdd(&evidence[3u], 1u);
}

@compute @workgroup_size(64)
fn apply_transfer(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let lineage_index = global_id.x;
  if (lineage_index >= params.lineage_capacity) { return; }
  if ((atomicLoad(&evidence[2u]) & ERROR_LAYOUT) != 0u) {
    copy_lineage(lineage_index);
    return;
  }
  let phases = lineage_phases(lineage_index);
  if (phases.valid == 0u || (phases.count > 0u && !lineage_mechanics_valid(phases))) {
    copy_lineage(lineage_index);
    return;
  }
  if (phases.count == 0u) {
    copy_lineage(lineage_index);
    return;
  }
  for (var target_phase = 1u; target_phase <= 4u; target_phase = target_phase + 1u) {
    let target_index = phase_lane_index(lineage_index, target_phase);
    let phase_bit = 1u << (target_phase - 1u);
    if ((phases.phase_mask & phase_bit) != 0u) {
      let aggregate = phase_aggregate(lineage_index, target_phase);
      if (aggregate.mass > params.mass_epsilon) {
        write_phase_slot(target_index, target_phase, phases, aggregate);
      } else {
        clear_phase_slot(target_index, target_phase, phases.material_id);
      }
    } else {
      clear_phase_slot(target_index, target_phase, phases.material_id);
    }
  }
  atomicAdd(&evidence[5u], 1u);
}
`;

async function readBuffer(device, sourceBuffer, byteLength, label) {
  const readback = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

export function createSphPhaseCarrierTransferWebGpuEncoderStage({
  device,
  sphParticleState,
  mlsMpmParticleState,
  thermalMaterialTable,
  mechanicsMaterialTable,
  phaseCarrierPlan = sphParticleState?.phaseCarrierPlan,
  sourceStateBuffer,
  sourceThermoBuffer,
  sourceMechanicsBuffer,
  // Set this only when mechanics lane 28 genuinely carries a resolved absolute
  // pressure for every particle. It does not today, so the pressure-adjusted
  // plateau stays inert and the reference ladder is used, exactly as before.
  absolutePressureAuthority = false,
  retainOutputParticleBuffers = false,
  readbackMode = NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('Phase-carrier transfer requires a WebGPU-like device');
  }
  const plan = assertInputs({
    sphParticleState,
    mlsMpmParticleState,
    thermalMaterialTable,
    mechanicsMaterialTable,
    phaseCarrierPlan
  });
  for (const [name, buffer] of Object.entries({
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer
  })) {
    if (!buffer || webGpuBufferDevice(buffer) !== device) {
      throw new TypeError(`Phase-carrier transfer ${name} must belong to the runtime device`);
    }
  }

  const closure = createClosureRows(thermalMaterialTable, mechanicsMaterialTable);
  const closureBuffer = uploadStorageBuffer(
    device,
    'ulg-sph-phase-carrier-transfer-closure-rows',
    closure.values
  );
  const evidenceValues = initialEvidence(plan.lineageCapacity);
  const evidenceBuffer = uploadStorageBuffer(
    device,
    'ulg-sph-phase-carrier-transfer-evidence',
    evidenceValues,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const stateByteLength = sphParticleState.particleCount
    * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const thermoByteLength = sphParticleState.particleCount
    * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsByteLength = mlsMpmParticleState.particleCount
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const outStateBuffer = createStorageBuffer(
    device,
    'ulg-sph-phase-carrier-transfer-state',
    stateByteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const outThermoBuffer = createStorageBuffer(
    device,
    'ulg-sph-phase-carrier-transfer-thermo',
    thermoByteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const outMechanicsBuffer = createStorageBuffer(
    device,
    'ulg-sph-phase-carrier-transfer-mechanics',
    mechanicsByteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-phase-carrier-transfer-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    plan,
    closure,
    absolutePressureAuthority
  }));

  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform')
  ];
  const preflightPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-phase-carrier-transfer.v3.preflight',
    label: 'ulg-sph-phase-carrier-transfer-preflight',
    code: sphPhaseCarrierTransferWgsl,
    entryPoint: 'preflight',
    bindings
  });
  const applyPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-phase-carrier-transfer.v3.apply',
    label: 'ulg-sph-phase-carrier-transfer-apply',
    code: sphPhaseCarrierTransferWgsl,
    entryPoint: 'apply_transfer',
    bindings
  });
  const bindGroupEntries = [
      { binding: 0, resource: { buffer: sourceStateBuffer } },
      { binding: 1, resource: { buffer: sourceThermoBuffer } },
      { binding: 2, resource: { buffer: sourceMechanicsBuffer } },
      { binding: 3, resource: { buffer: closureBuffer } },
      { binding: 4, resource: { buffer: outStateBuffer } },
      { binding: 5, resource: { buffer: outThermoBuffer } },
      { binding: 6, resource: { buffer: outMechanicsBuffer } },
      { binding: 7, resource: { buffer: evidenceBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } }
  ];
  const preflightBindGroup = device.createBindGroup({
    layout: preflightPipeline.bindGroupLayout,
    entries: bindGroupEntries
  });
  const applyBindGroup = device.createBindGroup({
    layout: applyPipeline.bindGroupLayout,
    entries: bindGroupEntries
  });
  const workgroups = Math.max(1, Math.ceil(plan.lineageCapacity / 64));
  let cleaned = false;
  let outputsDestroyed = false;
  let outputDestroyScheduled = false;
  let outputDestroyRelease = null;
  const destroyedBuffers = new Set();
  const destroyBufferOnce = (buffer) => {
    if (!buffer || destroyedBuffers.has(buffer)) return;
    buffer.destroy?.();
    destroyedBuffers.add(buffer);
  };
  const destroyOutputs = () => {
    if (outputsDestroyed) return;
    let firstError = null;
    for (const buffer of [
      outStateBuffer,
      outThermoBuffer,
      outMechanicsBuffer
    ]) {
      try {
        destroyBufferOnce(buffer);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    outputsDestroyed = true;
  };
  const cleanup = () => {
    if (cleaned) return;
    let firstError = null;
    for (const buffer of [
      closureBuffer,
      evidenceBuffer,
      paramsBuffer
    ]) {
      try {
        destroyBufferOnce(buffer);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (!retainOutputParticleBuffers) {
      try {
        destroyOutputs();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    cleaned = true;
  };
  const result = {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_SCHEMA,
    status: 'phase-carrier-transfer-submitted',
    backend: 'webgpu',
    particleCount: sphParticleState.particleCount,
    phaseCarrierPlan: { ...phaseCarrierPlan },
    lineageCapacity: plan.lineageCapacity,
    primaryCapacity: plan.primaryCapacity,
    phaseLaneCount: plan.phaseLaneCount,
    phaseLaneStride: plan.phaseLaneStride,
    companionStart: plan.companionStart,
    lineageCount: plan.lineageCapacity,
    state: new Float32Array(),
    thermo: new Float32Array(),
    mechanics: new Float32Array(),
    evidence: null,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    mechanicsBuffer: retainOutputParticleBuffers ? outMechanicsBuffer : null,
    stateBufferByteLength: stateByteLength,
    thermoBufferByteLength: thermoByteLength,
    mechanicsBufferByteLength: mechanicsByteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    readbackMode,
    fullReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
    ...(readbackMode === NO_FULL_READBACK_MODE
      ? createGpuReadbackTelemetry({
          scope: 'sph-phase-carrier-transfer-webgpu',
          mapAsyncCount: 0,
          readbackBytes: 0
        })
      : createGpuReadbackTelemetry({
          scope: 'sph-phase-carrier-transfer-webgpu',
          complete: false,
          unknownSources: ['full-readback-pending']
        })),
    failClosedPolicy: 'global-layout-copy-through-lineage-local-invalid-copy-through',
    conservationPolicy: 'mass-current-volume-momentum-first-moment-total-energy-with-relative-kinetic-thermalization',
    destroyOutputParticleBuffers: retainOutputParticleBuffers
      ? ({ queueOrderedFinalConsumer = null } = {}) => {
          if (outputsDestroyed) return true;
          if (outputDestroyScheduled) {
            return outputDestroyRelease ?? true;
          }
          const producerClaim =
            result.queueOrderedCleanupClaim ?? null;
          if (queueOrderedFinalConsumer && producerClaim) {
            outputDestroyScheduled = true;
            try {
              const receipt = releaseSubmittedWorkCleanupQueueOrdered(
                device,
                destroyOutputs,
                {
                  queueOrderedFinalConsumer,
                  producerClaim,
                  producerOutput: result,
                  producerFamily: 'sph-phase-carrier-output'
                }
              );
              outputDestroyRelease = true;
              result.outputParticleBufferCleanupReceipt = receipt;
              result.outputParticleBufferCleanupStatus = receipt.status;
              result.outputParticleBufferQueueCompletionMethod =
                receipt.queueCompletionMethod;
            } catch (error) {
              if (error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED') {
                outputDestroyScheduled = false;
              }
              throw error;
            }
            return true;
          }
          if (producerClaim) {
            try {
              cancelQueueOrderedCleanupClaim(
                producerClaim,
                device,
                {
                  producerOutput: result,
                  cleanup: destroyOutputs
                }
              );
            } catch {
              // A sealed claim requires its published exact capability.
              // The host-fenced fallback below remains memory-safe.
            }
          }
          outputDestroyScheduled = true;
          outputDestroyRelease = deferSubmittedWorkCleanup(
            device,
            destroyOutputs
          );
          appendGpuReadbackTelemetryObservation(result, {
            hostQueueFenceCount: 1,
            deferredCleanupHostQueueFenceCount: 1
          }, {
            source: 'phase-carrier-output-buffer-cleanup'
          });
          result.outputParticleBufferCleanupStatus =
            'submitted-output-cleanup-deferred-after-host-queue-fence';
          result.outputParticleBufferQueueCompletionMethod =
            'gpu-queue-on-submitted-work-done';
          return outputDestroyRelease ?? true;
        }
      : null,
    scientificValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: 'peercompute.ulg.sph-phase-carrier-transfer-encoder-stage.v2',
    status: 'phase-carrier-transfer-encoder-stage-ready',
    result,
    stateBuffer: outStateBuffer,
    thermoBuffer: outThermoBuffer,
    mechanicsBuffer: outMechanicsBuffer,
    evidenceBuffer,
    stateBufferByteLength: stateByteLength,
    thermoBufferByteLength: thermoByteLength,
    mechanicsBufferByteLength: mechanicsByteLength,
    evidenceBufferByteLength: evidenceValues.byteLength,
    encode(encoder) {
      const preflight = encoder.beginComputePass({ label: 'ulg-sph-phase-carrier-transfer-preflight' });
      preflight.setPipeline(preflightPipeline.pipeline);
      preflight.setBindGroup(0, preflightBindGroup);
      preflight.dispatchWorkgroups(workgroups);
      preflight.end();
      const apply = encoder.beginComputePass({ label: 'ulg-sph-phase-carrier-transfer-apply' });
      apply.setPipeline(applyPipeline.pipeline);
      apply.setBindGroup(0, applyBindGroup);
      apply.dispatchWorkgroups(workgroups);
      apply.end();
    },
    cleanupSubmittedWork: cleanup,
    cleanupRetainedOutput: destroyOutputs
  };
}

export async function runSphPhaseCarrierTransferWebGpu(args = {}) {
  const stage = createSphPhaseCarrierTransferWebGpuEncoderStage(args);
  const {
    device,
    retainOutputParticleBuffers = false,
    queueOrderedProducerClaims = []
  } = args;
  const noFullReadback =
    stage.result.readbackMode === NO_FULL_READBACK_MODE;
  const exactConsumerClaims =
    Array.isArray(queueOrderedProducerClaims)
      ? queueOrderedProducerClaims
      : [];
  const authenticatedQueueOrderedRoute =
    noFullReadback && exactConsumerClaims.length > 0;
  const encoder = device.createCommandEncoder();
  stage.encode(encoder);
  const commandBuffer = encoder.finish();
  let submittedWorkCleanupClaim = null;
  let submittedWorkFinalConsumer = null;
  let outputCleanupClaim = null;
  if (authenticatedQueueOrderedRoute) {
    try {
      if (retainOutputParticleBuffers) {
        outputCleanupClaim =
          registerQueueOrderedCleanupClaim(
            phaseCarrierOutputCleanupClaimIssuer,
            device,
            {
              producerOutput: stage.result,
              cleanup: stage.cleanupRetainedOutput
            }
          );
        Object.defineProperty(
          stage.result,
          'queueOrderedCleanupClaim',
          {
            value: outputCleanupClaim,
            enumerable: false
          }
        );
      }
      submittedWorkCleanupClaim = registerQueueOrderedCleanupClaim(
        phaseCarrierTransferCleanupClaimIssuer,
        device,
        {
          producerOutput: stage,
          cleanup: stage.cleanupSubmittedWork
        }
      );
      submittedWorkFinalConsumer =
        submitQueueOrderedFinalConsumerWork(
          device,
          [commandBuffer],
          {
            finalConsumerOwner: stage,
            producerClaims: [
              ...exactConsumerClaims,
              submittedWorkCleanupClaim
            ]
          }
        );
    } catch (error) {
      if (submittedWorkCleanupClaim) {
        cancelQueueOrderedCleanupClaim(
          submittedWorkCleanupClaim,
          device,
          {
            producerOutput: stage,
            cleanup: stage.cleanupSubmittedWork
          }
        );
      }
      if (outputCleanupClaim) {
        cancelQueueOrderedCleanupClaim(
          outputCleanupClaim,
          device,
          {
            producerOutput: stage.result,
            cleanup: stage.cleanupRetainedOutput
          }
        );
      }
      throw error;
    }
  } else {
    device.queue.submit([commandBuffer]);
  }
  if (!noFullReadback) {
    const [stateBytes, thermoBytes, mechanicsBytes, evidenceBytes] = await Promise.all([
      readBuffer(device, stage.stateBuffer, stage.stateBufferByteLength, 'ulg-phase-transfer-state-readback'),
      readBuffer(device, stage.thermoBuffer, stage.thermoBufferByteLength, 'ulg-phase-transfer-thermo-readback'),
      readBuffer(device, stage.mechanicsBuffer, stage.mechanicsBufferByteLength, 'ulg-phase-transfer-mechanics-readback'),
      readBuffer(device, stage.evidenceBuffer, stage.evidenceBufferByteLength, 'ulg-phase-transfer-evidence-readback')
    ]);
    stage.result.state = new Float32Array(stateBytes);
    stage.result.thermo = new Float32Array(thermoBytes);
    stage.result.mechanics = new Float32Array(mechanicsBytes);
    stage.result.evidence = new Uint32Array(evidenceBytes);
    Object.assign(stage.result, createGpuReadbackTelemetry({
      scope: 'sph-phase-carrier-transfer-webgpu',
      mapAsyncCount: 4,
      readbackBytes:
        Math.max(4, stage.stateBufferByteLength)
        + Math.max(4, stage.thermoBufferByteLength)
        + Math.max(4, stage.mechanicsBufferByteLength)
        + Math.max(4, stage.evidenceBufferByteLength)
    }));
    stage.result.invalidLineageCount = stage.result.evidence[6];
    stage.result.firstInvalidLineage = stage.result.evidence[7] === 0xffffffff
      ? null
      : stage.result.evidence[7];
    stage.result.status = (stage.result.evidence[2] & 1) !== 0
      ? 'phase-carrier-transfer-failed-closed'
      : (stage.result.evidence[6] > 0
        ? 'phase-carrier-transfer-complete-with-rejected-lineages'
        : 'phase-carrier-transfer-complete');
  }
  if (noFullReadback) {
    if (authenticatedQueueOrderedRoute) {
      Object.defineProperty(
        stage.result,
        'queueOrderedFinalConsumerCapability',
        {
          value: submittedWorkFinalConsumer,
          enumerable: false
        }
      );
      try {
        const cleanupReceipt = releaseSubmittedWorkCleanupQueueOrdered(
          device,
          stage.cleanupSubmittedWork,
          {
            queueOrderedFinalConsumer: submittedWorkFinalConsumer,
            producerClaim: submittedWorkCleanupClaim,
            producerOutput: stage,
            producerFamily:
              'sph-phase-carrier-transfer-submitted-work'
          }
        );
        Object.assign(stage.result, {
          submittedWorkCleanupReceipt: cleanupReceipt,
          submittedWorkCleanupStatus: cleanupReceipt.status,
          submittedWorkCleanupHostQueueFenceCount:
            cleanupReceipt.hostQueueFenceCount,
          submittedWorkCleanupMethod: cleanupReceipt.queueCompletionMethod
        });
      } catch (error) {
        deferSubmittedWorkCleanup(
          device,
          stage.cleanupSubmittedWork
        );
        appendGpuReadbackTelemetryObservation(stage.result, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'phase-carrier-submitted-work-cleanup-retry'
        });
        Object.assign(stage.result, {
          submittedWorkCleanupStatus:
            'queue-ordered-local-cleanup-retry-deferred-after-host-queue-fence',
          submittedWorkCleanupError:
            error instanceof Error ? error.message : String(error),
          submittedWorkCleanupHostQueueFenceCount: 1,
          submittedWorkCleanupMethod:
            'gpu-queue-on-submitted-work-done'
        });
      }
    } else {
      deferSubmittedWorkCleanup(device, stage.cleanupSubmittedWork);
      appendGpuReadbackTelemetryObservation(stage.result, {
        hostQueueFenceCount: 1,
        deferredCleanupHostQueueFenceCount: 1
      }, {
        source: 'phase-carrier-submitted-work-cleanup'
      });
      Object.assign(stage.result, {
        submittedWorkCleanupStatus:
          'submitted-work-cleanup-deferred-after-host-queue-fence',
        submittedWorkCleanupHostQueueFenceCount: 1,
        submittedWorkCleanupMethod:
          'gpu-queue-on-submitted-work-done'
      });
    }
  } else {
    stage.cleanupSubmittedWork();
  }
  if (!retainOutputParticleBuffers) {
    stage.result.stateBuffer = null;
    stage.result.thermoBuffer = null;
    stage.result.mechanicsBuffer = null;
  }
  return stage.result;
}

export function retainedPhaseCarrierTransferOutputBuffers(stageOrResult) {
  const source = stageOrResult?.result || stageOrResult;
  const componentOwnershipFields = Object.fromEntries(
    ['state', 'thermo', 'mechanics'].map((component) => {
      const buffer = source?.[`${component}Buffer`]
        || stageOrResult?.[`${component}Buffer`]
        || null;
      const ownershipField =
        `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`;
      const declaredOwnership = source?.componentOwnership?.[component]
        ?? source?.bufferOwnership?.[component];
      const owned = !buffer
        ? false
        : (typeof source?.[ownershipField] === 'boolean'
            ? source[ownershipField]
            : (typeof declaredOwnership === 'boolean'
                ? declaredOwnership
                : (declaredOwnership === 'borrowed'
                    || declaredOwnership === 'external'
                    ? false
                    : true)));
      return [ownershipField, owned];
    })
  );
  return {
    stateBuffer: source?.stateBuffer || stageOrResult?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || stageOrResult?.thermoBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || stageOrResult?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || stageOrResult?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || stageOrResult?.thermoBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || stageOrResult?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers:
      source?.destroyOutputParticleBuffers
      || stageOrResult?.destroyOutputParticleBuffers
      || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents
      || stageOrResult?.destroyOutputParticleBufferComponents
      || null,
    queueOrderedRetainedOutputFinalConsumerCapability:
      source?.queueOrderedRetainedOutputFinalConsumerCapability ?? null,
    ...componentOwnershipFields
  };
}
