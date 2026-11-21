import { createPostMechanicsStageOutputSeal } from './sphMechanicsRefreshGpuKernel.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import { encodeLawActivationCount } from './lawActivationReceiptRing.js';
import {
  createSchroederPhaseDormancyStage,
  phaseWindowsFromThermalMaterialTable
} from './schroederPhaseRadiationDormancyGpu.js';
import {
  assertSphLegacyMassPathAllowed,
  markSphExactMassDerivedBuffers,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { sphPhaseCarrierThermodynamicsWgsl } from './sphPhaseCarrierThermodynamicsWgsl.js';
import { assertSphMechanicsGasLayout } from '../../../ulg-gpu-abi/src/sphGasConstitutive.js';
import { sphGasConstitutiveWgsl } from '../../../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';
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
  try {
    if (values.byteLength > 0) device.queue.writeBuffer(buffer, 0, values);
  } catch (error) {
    try { buffer.destroy?.(); } catch {}
    throw error;
  }
  return buffer;
}

export function packSphPhaseCarrierClosureRows(thermalMaterialTable, mechanicsMaterialTable) {
  const gasOffset = assertSphMechanicsGasLayout(mechanicsMaterialTable);
  const thermalSegments = thermalMaterialTable.segments;
  const mechanicsRecords = mechanicsMaterialTable.records.subarray(0, mechanicsMaterialTable.phaseRecordCount * 12);
  const gasRecords = gasOffset > 0 ? mechanicsMaterialTable.records.subarray(gasOffset * 4) : new Float32Array(0);
  // The thermal material records ride along so the shader can resolve each
  // material's pressure-adjusted carrier law (lanes 5-7) without a fourth
  // storage binding. Stride 8 floats = 2 vec4 per record.
  const materialRecords = thermalMaterialTable.records;
  const values = new Float32Array(
    thermalSegments.length + mechanicsRecords.length + materialRecords.length + gasRecords.length
  );
  values.set(thermalSegments, 0);
  values.set(mechanicsRecords, thermalSegments.length);
  values.set(materialRecords, thermalSegments.length + mechanicsRecords.length);
  values.set(gasRecords, thermalSegments.length + mechanicsRecords.length + materialRecords.length);
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

// The transfer's own closure: the shared rows plus, after them, the explicit
// vaporization records (sphThermalGpuKernel.js) for bulk boiling. Other
// stages keep the shared layout, whose length encodes the gas section; the
// transfer carries the gas-record count and the vaporization offset instead.
export function packSphPhaseCarrierTransferClosureRows(thermalMaterialTable, mechanicsMaterialTable) {
  const shared = packSphPhaseCarrierClosureRows(thermalMaterialTable, mechanicsMaterialTable);
  const vaporization = thermalMaterialTable.explicitVaporizationRecords instanceof Float32Array
    ? thermalMaterialTable.explicitVaporizationRecords : new Float32Array(0);
  if (vaporization.length % 8 !== 0) throw new RangeError('explicit vaporization records use stride 8');
  const values = new Float32Array(shared.values.length + vaporization.length);
  values.set(shared.values, 0);
  values.set(vaporization, shared.values.length);
  const materialEnd = shared.materialRecordOffsetVec4 + shared.materialRecordCount * 2;
  return {
    ...shared,
    values,
    gasRecordCount: shared.values.length / 4 - materialEnd,
    vaporizationOffsetVec4: shared.values.length / 4,
    vaporizationRecordCount: vaporization.length / 8
  };
}

export const SPH_PHASE_CARRIER_TRANSFER_PARAMS_BYTES = 96;
// Words per row the interface-front consumer reads (the SS thermal proposal's
// derived row: fronts at 10..14, skin outputs at 15..19, face offset 20..22).
export const SPH_PHASE_CARRIER_INTERFACE_FRONT_MIN_ROW_WORDS = 24;

const interfaceFrontDummyBuffers = new WeakMap();
function interfaceFrontDummyBuffer(device) {
  let buffer = interfaceFrontDummyBuffers.get(device);
  if (!buffer) {
    buffer = uploadStorageBuffer(
      device,
      'ulg-sph-phase-carrier-transfer-interface-front-absent',
      new Uint32Array(SPH_PHASE_CARRIER_INTERFACE_FRONT_MIN_ROW_WORDS)
    );
    interfaceFrontDummyBuffers.set(device, buffer);
  }
  return buffer;
}

// A front source is admitted only when it names a live buffer on this device,
// a row stride the shader understands, and a nonzero epoch. Anything else is
// the absent front: no skin conversion, the established transfer bit for bit.
export function resolveSphPhaseCarrierInterfaceFront(interfacePhaseFront, device) {
  const front = interfacePhaseFront || null;
  const epoch = Number(front?.epoch);
  const headerWords = Number(front?.headerWords);
  const rowWords = Number(front?.rowWords);
  if (
    !front?.buffer
    || webGpuBufferDevice(front.buffer) !== device
    || !Number.isSafeInteger(epoch) || epoch <= 0 || epoch >= 2 ** 29
    || !Number.isSafeInteger(headerWords) || headerWords < 0
    || !Number.isSafeInteger(rowWords)
    || rowWords < SPH_PHASE_CARRIER_INTERFACE_FRONT_MIN_ROW_WORDS
  ) {
    return null;
  }
  return Object.freeze({ buffer: front.buffer, epoch, headerWords, rowWords });
}

function createParamsArray({
  particleCount,
  plan,
  closure,
  absolutePressureAuthority = false,
  interfaceFront = null
}) {
  const buffer = new ArrayBuffer(SPH_PHASE_CARRIER_TRANSFER_PARAMS_BYTES);
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
  view.setUint32(64, interfaceFront ? 1 : 0, true);
  view.setUint32(68, interfaceFront ? interfaceFront.epoch : 0, true);
  view.setUint32(72, interfaceFront ? interfaceFront.headerWords : 0, true);
  view.setUint32(76, interfaceFront ? interfaceFront.rowWords : 0, true);
  view.setUint32(80, closure.gasRecordCount ?? 0, true);
  view.setUint32(84, closure.vaporizationOffsetVec4 ?? 0, true);
  view.setUint32(88, closure.vaporizationRecordCount ?? 0, true);
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
    0, // interface-front skin conversions (source carriers)
    0, // bulk explicit-branch fusion conversions (source carriers)
    0, // bulk explicit-branch boiling conversions (source carriers)
    0, 0, 0, 0, 0
  ]);
}

export const sphPhaseCarrierTransferWgsl = /* wgsl */ `
${sphPhaseCarrierThermodynamicsWgsl}
${sphGasConstitutiveWgsl}
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
  // Interface phase-front skin conversion (plan/todo/interface-resolution.md).
  // Rows come from the SS thermal proposal's derived buffer; a row is consumed
  // only when its stamp carries this step's front_epoch.
  front_enabled: u32,
  front_epoch: u32,
  front_header_words: u32,
  front_row_words: u32,
  // Transfer-local closure tail (packSphPhaseCarrierTransferClosureRows).
  gas_record_count: u32,
  vaporization_offset_vec4: u32,
  vaporization_record_count: u32,
  _closure_pad: u32,
};

struct FrontConversion {
  ready: u32,
  own_phase: u32,
  target_phase: u32,
  mass: f32,
  target_energy: f32,
  own_energy: f32,
  temperature: f32,
  // The converted mass is born at its contact faces; the remainder moves by
  // -mass * offset / (m - mass) so the lineage's first moment is unchanged.
  face_offset: vec3<f32>,
  own_offset: vec3<f32>,
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
@group(0) @binding(9) var<storage, read> interface_front: array<u32>;

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

// Interface phase-front skin conversion. The thermal proposal partitioned the
// pair heat a carrier received across a contact whose interface temperature
// lies past one of its own transition temperatures T*: the part its bulk could
// conduct away from a front pinned at T* stayed sensible, and the excess E is
// latent work on the skin. Here that skin mass m = E / (u_target - u_pre)
// leaves the carrier as the next phase at T*, and the remaining mass keeps the
// rest of the carrier's energy, so the lineage's energy is unchanged.
// A carrier converts at most once per step: the interface skin front when the
// thermal proposal stamped one, otherwise the bulk explicit-branch fusion.
fn front_conversion(source_index: u32) -> FrontConversion {
  let skin = skin_front_conversion(source_index);
  if (skin.ready == 1u) { return skin; }
  let fusion = explicit_fusion_conversion(source_index);
  if (fusion.ready == 1u) { return fusion; }
  return explicit_boiling_conversion(source_index);
}

// ln p_eq(T, P) - ln P of an explicit condensable (its model's own curve,
// see sphThermalGpuKernel.js explicitVaporizationRecord). Positive means the
// liquid's saturation pressure exceeds the total pressure: it boils.
fn explicit_boiling_excess(record: u32, temperature: f32, pressure: f32) -> f32 {
  let base = params.vaporization_offset_vec4 + record * 2u;
  let a = closure_rows[base];
  let b = closure_rows[base + 1u];
  let t_ref = a.y;
  let p_ref = a.z;
  let h_fg = a.w;
  let dcp = b.x;
  let r = b.y;
  let v_l = b.z;
  let dt = temperature - t_ref;
  return log(p_ref) + h_fg / r * (dt / t_ref) / temperature
    + dcp / r * (log(1.0 + dt / t_ref) - dt / temperature)
    + v_l * (pressure - p_ref) / (r * temperature)
    - log(pressure);
}

// Bulk boiling for explicit-branch condensables: a liquid whose temperature
// exceeds T_sat(P) at its own absolute pressure sends
// m (u - u_l(T_sat)) / (u_g(T_sat) - u_l(T_sat)) to its gas lane at
// u_g(T_sat); the remainder keeps the rest of its energy (energy-exact). Only
// liquid -> gas: below boiling, evaporation and condensation depend on the
// vapor's partial pressure, which is the vapor-exchange law's authority.
// Without absolute-pressure authority the pressure is the reference ladder's
// (as the legacy plateau boils on its packed reference plateau).
fn explicit_boiling_conversion(source_index: u32) -> FrontConversion {
  let none = FrontConversion(0u, 0u, 0u, 0.0, 0.0, 0.0, 0.0, vec3<f32>(0.0), vec3<f32>(0.0));
  if (params.vaporization_record_count == 0u) { return none; }
  let s0 = state0(source_index);
  let s1 = state1(source_index);
  let t0 = thermo0(source_index);
  let fractions = thermo1(source_index);
  let mass = s0.w;
  let energy = s1.w;
  if (!(mass > params.mass_epsilon) || !finite_f32(energy)) { return none; }
  if (!nearly_equal(fractions.y, 1.0) || fractions.x > params.fraction_activation_epsilon
    || fractions.z > params.fraction_activation_epsilon || fractions.w > params.fraction_activation_epsilon) {
    return none;
  }
  var record = INVALID_INDEX;
  for (var index = 0u; index < params.vaporization_record_count; index = index + 1u) {
    let row = closure_rows[params.vaporization_offset_vec4 + index * 2u];
    if (row.x == t0.x && closure_rows[params.vaporization_offset_vec4 + index * 2u + 1u].w > 0.0) {
      record = index;
      break;
    }
  }
  if (record == INVALID_INDEX) { return none; }
  let pressure = select(
    closure_rows[params.vaporization_offset_vec4 + record * 2u + 1u].w,
    source_mechanics[source_index * 8u + 7u].x,
    params.absolute_pressure_authority != 0u
  );
  if (!finite_f32(pressure) || !(pressure > 0.0)) { return none; }
  // The liquid's temperature on its own packed branch line.
  var liquid_lo = 0.0;
  var liquid_hi = 0.0;
  var energy_lo = 0.0;
  var energy_hi = 0.0;
  var found = false;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    if (row0.x == t0.x && row0.y > 2.5 && u32(round(row0.z)) == 2u && u32(round(row0.w)) == 2u) {
      let row1 = closure_rows[base + 1u];
      energy_lo = row1.x; energy_hi = row1.y; liquid_lo = row1.z; liquid_hi = row1.w;
      found = true;
      break;
    }
  }
  if (!found || !(energy_hi > energy_lo) || !(liquid_hi > liquid_lo)) { return none; }
  let temperature = liquid_lo + (energy - energy_lo) * (liquid_hi - liquid_lo) / (energy_hi - energy_lo);
  if (!finite_f32(temperature) || !(temperature > liquid_lo)
    || !(explicit_boiling_excess(record, temperature, pressure) > 0.0)) { return none; }
  // T_sat(P) by bisection on the monotone excess (positive latent heat).
  var lo = liquid_lo;
  var hi = temperature;
  if (explicit_boiling_excess(record, lo, pressure) > 0.0) { return none; }
  for (var iteration = 0u; iteration < 40u; iteration = iteration + 1u) {
    let mid = 0.5 * (lo + hi);
    if (explicit_boiling_excess(record, mid, pressure) > 0.0) { hi = mid; } else { lo = mid; }
  }
  let saturation_temperature = hi;
  let liquid_energy = explicit_branch_energy_at(t0.x, 2u, saturation_temperature);
  let gas_energy = explicit_branch_energy_at(t0.x, 3u, saturation_temperature);
  if (liquid_energy.y != 1.0 || gas_energy.y != 1.0 || !(gas_energy.x > liquid_energy.x)
    || !(energy > liquid_energy.x)) { return none; }
  var converted = min(mass * (energy - liquid_energy.x) / (gas_energy.x - liquid_energy.x), mass);
  if (!finite_f32(converted) || !(converted > params.mass_epsilon)) { return none; }
  let whole = mass - converted <= params.mass_epsilon;
  let lineage_index = source_index % params.phase_lane_stride;
  let target_s0 = state0(phase_lane_index(lineage_index, 3u));
  // Gas never enters contact, so an existing gas carrier may gather from
  // anywhere; an empty gas lane nucleates only on a non-sliver conversion.
  if (!(target_s0.w > params.mass_epsilon) && !whole && converted < FUSION_NUCLEATION_FRACTION * mass) {
    return none;
  }
  var converted_energy = gas_energy.x;
  var own_energy = energy;
  if (whole) {
    converted = mass;
    converted_energy = energy;
  } else {
    own_energy = (mass * energy - converted * gas_energy.x) / (mass - converted);
    if (!finite_f32(own_energy)) { return none; }
  }
  return FrontConversion(1u, 2u, 3u, converted, converted_energy, own_energy,
    saturation_temperature, vec3<f32>(0.0), vec3<f32>(0.0));
}

const EXPLICIT_FUSION_LAW: u32 = 2u;
// Fraction of a carrier that must convert before it nucleates an empty
// condensed lane (~0.16 K of ice superheat). A smaller excess stays sensible
// until it accumulates, so no step's sliver becomes a free carrier.
const FUSION_NUCLEATION_FRACTION: f32 = 1.0e-3;

struct ExplicitFusion {
  valid: u32,
  temperature: f32,
  solid_energy: f32,
  liquid_energy: f32,
};

// u on the material's packed explicit branch for phase_id at temperature,
// from the same endpoints the thermal kernel inverts (y = 1 when found).
fn explicit_branch_energy_at(material_id: f32, phase_id: u32, temperature: f32) -> vec2<f32> {
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    if (row0.x != material_id || row0.y < 2.5
      || u32(round(row0.z)) != phase_id || u32(round(row0.w)) != phase_id) { continue; }
    let row1 = closure_rows[base + 1u];
    if (!(row1.y > row1.x) || !(row1.w > row1.z)
      || !(temperature >= row1.z) || !(temperature <= row1.w)) { return vec2<f32>(0.0, 0.0); }
    return vec2<f32>(row1.x + (temperature - row1.z) * (row1.y - row1.x) / (row1.w - row1.z), 1.0);
  }
  return vec2<f32>(0.0, 0.0);
}

fn explicit_fusion_for(material_id: f32) -> ExplicitFusion {
  let none = ExplicitFusion(0u, 0.0, 0.0, 0.0);
  for (var record = 0u; record < params.material_record_count; record = record + 1u) {
    let base = params.material_record_offset_vec4 + record * 2u;
    if (closure_rows[base].x != material_id) { continue; }
    let row1 = closure_rows[base + 1u];
    if (u32(round(row1.y)) != EXPLICIT_FUSION_LAW || !finite_f32(row1.w) || !(row1.w > 0.0)) {
      return none;
    }
    let solid = explicit_branch_energy_at(material_id, 1u, row1.w);
    let liquid = explicit_branch_energy_at(material_id, 2u, row1.w);
    if (solid.y != 1.0 || liquid.y != 1.0 || !(liquid.x > solid.x)) { return none; }
    return ExplicitFusion(1u, row1.w, solid.x, liquid.x);
  }
  return none;
}

// Bulk equilibrium fusion for explicit-branch (phase-caloric) materials, which
// have no plateau rows: phase is selected explicitly, so energy alone never
// melts or freezes a carrier there. A solid above u_s(T_f) sends
// m (u - u_s) / (u_l - u_s) to its liquid lane at u_l(T_f); a liquid below
// u_l(T_f) freezes m (u_l - u) / (u_l - u_s) at u_s(T_f). The remainder keeps
// the rest of the carrier's energy, so the lineage's energy is unchanged. The
// converted mass is born nested at the parent's centre (as a condensed skin is).
fn explicit_fusion_conversion(source_index: u32) -> FrontConversion {
  let none = FrontConversion(0u, 0u, 0u, 0.0, 0.0, 0.0, 0.0, vec3<f32>(0.0), vec3<f32>(0.0));
  let s0 = state0(source_index);
  let s1 = state1(source_index);
  let t0 = thermo0(source_index);
  let fractions = thermo1(source_index);
  let mass = s0.w;
  let energy = s1.w;
  if (!(mass > params.mass_epsilon) || !finite_f32(energy)) { return none; }
  var own_phase = 0u;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let fraction = fractions[lane];
    if (fraction > params.fraction_activation_epsilon) {
      if (own_phase != 0u || !nearly_equal(fraction, 1.0)) { return none; }
      own_phase = lane + 1u;
    }
  }
  if (own_phase != 1u && own_phase != 2u) { return none; }
  let fusion = explicit_fusion_for(t0.x);
  if (fusion.valid == 0u) { return none; }
  let latent = fusion.liquid_energy - fusion.solid_energy;
  var target_phase = 0u;
  var converted = 0.0;
  var target_energy = 0.0;
  if (own_phase == 1u && energy > fusion.solid_energy) {
    target_phase = 2u;
    converted = mass * (energy - fusion.solid_energy) / latent;
    target_energy = fusion.liquid_energy;
  } else if (own_phase == 2u && energy < fusion.liquid_energy) {
    target_phase = 1u;
    converted = mass * (fusion.liquid_energy - energy) / latent;
    target_energy = fusion.solid_energy;
  } else {
    return none;
  }
  converted = min(converted, mass);
  if (!finite_f32(converted) || !(converted > params.mass_epsilon)) { return none; }
  let whole = mass - converted <= params.mass_epsilon;
  let lineage_index = source_index % params.phase_lane_stride;
  let target_index = phase_lane_index(lineage_index, target_phase);
  let target_s0 = state0(target_index);
  if (!(target_s0.w > params.mass_epsilon)) {
    if (!whole && converted < FUSION_NUCLEATION_FRACTION * mass) { return none; }
  } else {
    // Merge only into a target carrier this one still touches; one that has
    // moved away would otherwise be pulled across the scene (skin rule).
    let own_row4 = source_mechanics[source_index * 8u + 4u];
    let target_row4 = source_mechanics[target_index * 8u + 4u];
    let own_edge = pow(max(own_row4.z * own_row4.w, 0.0), 1.0 / 3.0);
    let target_edge = pow(max(target_row4.z * target_row4.w, 0.0), 1.0 / 3.0);
    if (!(distance(s0.xyz, target_s0.xyz) <= 0.5 * (own_edge + target_edge))) { return none; }
  }
  var converted_energy = target_energy;
  var own_energy = energy;
  if (whole) {
    converted = mass;
    converted_energy = energy;
  } else {
    own_energy = (mass * energy - converted * target_energy) / (mass - converted);
    if (!finite_f32(own_energy)) { return none; }
  }
  return FrontConversion(1u, own_phase, target_phase, converted,
    converted_energy, own_energy, fusion.temperature, vec3<f32>(0.0), vec3<f32>(0.0));
}

// When a rising gas carrier (phase 3) partially condenses onto the liquid-gas
// plateau while its lineage's liquid carrier (phase 2) is occupied at a
// non-local distance (e.g. a floor pool), keep the micron-scale condensate
// co-advected inside the vapor parcel instead of teleporting it across empty
// space into the distant pool.
fn separated_vapor_retains_condensate(lineage_index: u32, source_index: u32) -> bool {
  let s0 = state0(source_index);
  if (!(s0.w > params.mass_epsilon)) { return false; }
  let fractions = thermo1(source_index);
  if (
    fractions.x > params.fraction_activation_epsilon
    || fractions.w > params.fraction_activation_epsilon
    || !(fractions.y > params.fraction_activation_epsilon)
    || !(fractions.z > params.fraction_activation_epsilon)
  ) { return false; }
  let liquid_index = phase_lane_index(lineage_index, 2u);
  let liquid_s0 = state0(liquid_index);
  if (!(liquid_s0.w > params.mass_epsilon)) { return false; }
  let liquid_row4 = source_mechanics[liquid_index * 8u + 4u];
  let liquid_edge = pow(max(liquid_row4.z * liquid_row4.w, 0.0), 1.0 / 3.0);
  return !(distance(s0.xyz, liquid_s0.xyz) <= 0.35 * liquid_edge);
}

fn retained_vapor_condensate_fraction(
  target_index: u32,
  target_phase: u32,
  material_id: f32,
  specific_energy: f32
) -> f32 {
  if (
    target_phase != 3u
    || front_conversion(target_index).ready != 0u
    || !separated_vapor_retains_condensate(target_index % params.phase_lane_stride, target_index)
  ) {
    return 0.0;
  }
  let absolute_pressure_pa = source_mechanics[target_index * 8u + 7u].x;
  let e0 = plateau_endpoint(material_id, 2u, 3u, specific_energy, 2u, absolute_pressure_pa);
  let e1 = plateau_endpoint(material_id, 2u, 3u, specific_energy, 3u, absolute_pressure_pa);
  if (e0.y == 0.0 || e1.y == 0.0 || !(e1.x > e0.x) || specific_energy >= e1.x) {
    return 0.0;
  }
  return clamp((e1.x - specific_energy) / (e1.x - e0.x), 0.0, 1.0);
}

fn skin_front_conversion(source_index: u32) -> FrontConversion {
  var none = FrontConversion(0u, 0u, 0u, 0.0, 0.0, 0.0, 0.0, vec3<f32>(0.0), vec3<f32>(0.0));
  if (params.front_enabled == 0u || params.front_row_words < 24u) { return none; }
  let row = params.front_header_words + source_index * params.front_row_words;
  if (row + 24u > arrayLength(&interface_front)) { return none; }
  let stamp = interface_front[row + 19u];
  if ((stamp >> 3u) != params.front_epoch || params.front_epoch == 0u) { return none; }
  let target_phase = stamp & 7u;
  let s0 = state0(source_index);
  let s1 = state1(source_index);
  let t0 = thermo0(source_index);
  let fractions = thermo1(source_index);
  let mass = s0.w;
  if (!(mass > params.mass_epsilon) || target_phase < 1u || target_phase > 4u) { return none; }
  // Only a single-phase carrier has a bulk below its own front. A carrier
  // already on a plateau is at T* everywhere and splits by equilibrium.
  var own_phase = 0u;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let fraction = fractions[lane];
    if (fraction > params.fraction_activation_epsilon) {
      if (own_phase != 0u || !nearly_equal(fraction, 1.0)) { return none; }
      own_phase = lane + 1u;
    }
  }
  if (own_phase == 0u || own_phase == target_phase) { return none; }
  if (target_phase != own_phase + 1u && target_phase + 1u != own_phase) { return none; }
  let skin_energy_j = bitcast<f32>(interface_front[row + 15u]);
  let source_energy = bitcast<f32>(interface_front[row + 16u]);
  let target_energy = bitcast<f32>(interface_front[row + 17u]);
  let front_temperature = bitcast<f32>(interface_front[row + 18u]);
  let face_offset = vec3<f32>(
    bitcast<f32>(interface_front[row + 20u]),
    bitcast<f32>(interface_front[row + 21u]),
    bitcast<f32>(interface_front[row + 22u])
  );
  if (
    !finite_f32(face_offset.x) || !finite_f32(face_offset.y) || !finite_f32(face_offset.z)
  ) { return none; }
  // A lane holds one carrier per phase per lineage. Converting into a
  // condensed lane whose carrier sits elsewhere would merge the skin into it
  // and pull that solid or liquid carrier across the scene to the face,
  // which contact must then undo every step. Convert into a condensed lane
  // only while it is empty or already touches this face. Gas never enters
  // contact, so a gas lane may gather its skin from anywhere.
  // A condensed skin (melt or freeze) deposits onto condensed matter that is
  // already there; it never nucleates a free carrier. An empty condensed lane
  // would turn one step's skin (~1e-12 kg for iron) into a free solid beside
  // 1e-4 kg neighbours, a contact the Jacobi solve cannot converge on. Its
  // energy then stays in the bulk, which the canonical apply already holds.
  if (target_phase <= 2u) {
    let lineage_index = source_index % params.phase_lane_stride;
    let target_index = phase_lane_index(lineage_index, target_phase);
    let target_s0 = state0(target_index);
    if (!(target_s0.w > params.mass_epsilon)) { return none; }
    {
      let own_row4 = source_mechanics[source_index * 8u + 4u];
      let target_row4 = source_mechanics[target_index * 8u + 4u];
      let own_edge = pow(max(own_row4.z * own_row4.w, 0.0), 1.0 / 3.0);
      let target_edge = pow(max(target_row4.z * target_row4.w, 0.0), 1.0 / 3.0);
      let face_position = s0.xyz + face_offset;
      if (
        !(distance(face_position, target_s0.xyz) <= 0.5 * (own_edge + target_edge))
      ) { return none; }
    }
  }
  let denominator = target_energy - source_energy;
  if (
    !finite_f32(skin_energy_j) || !finite_f32(source_energy)
    || !finite_f32(target_energy) || !finite_f32(front_temperature)
    || !finite_f32(denominator) || denominator == 0.0
    || skin_energy_j * denominator <= 0.0 || front_temperature <= 0.0
  ) { return none; }
  var converted = min(skin_energy_j / denominator, mass);
  if (!(converted > params.mass_epsilon)) { return none; }
  let energy = s1.w;
  var own_energy = energy;
  var converted_energy = target_energy;
  // Gas never enters contact, so a gas skin is born at its contact face. A
  // condensed skin (melt or freeze) is born nested at the parent's centre:
  // the contact graph occludes a companion wholly inside its parent, while a
  // new solid or liquid at the face would sit squeezed between two carriers.
  var converted_offset = select(vec3<f32>(0.0), face_offset, target_phase >= 3u);
  var own_offset = vec3<f32>(0.0);
  if (mass - converted <= params.mass_epsilon) {
    // The whole carrier converts; it carries its own energy and place.
    converted = mass;
    converted_energy = energy;
    converted_offset = vec3<f32>(0.0);
  } else {
    own_energy = (mass * energy - converted * target_energy) / (mass - converted);
    own_offset = -converted_offset * (converted / (mass - converted));
    if (!finite_f32(own_energy)) { return none; }
  }
  return FrontConversion(1u, own_phase, target_phase, converted,
    converted_energy, own_energy, front_temperature, converted_offset, own_offset);
}

fn phase_lane_index(lineage_index: u32, phase_id: u32) -> u32 {
  return (phase_id - 1u) * params.phase_lane_stride + lineage_index;
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

fn closure_sound_speed(record: u32, temperature: f32) -> f32 {
  let row1 = closure_rows[params.mechanics_offset_vec4 + record * 3u + 1u];
  let end = params.material_record_offset_vec4 + params.material_record_count * 2u;
  if (row1.w != 2.0 || params.gas_record_count == 0u) { return row1.z; }
  if (params.gas_record_count != params.mechanics_record_count
    || arrayLength(&closure_rows) < end + params.gas_record_count) { return -1.0; }
  return gas_constitutive_sound_speed(closure_rows[end + record], temperature);
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
    let conversion = front_conversion(source_index);
    if (conversion.ready == 1u) {
      let converted_bit = 1u << (conversion.target_phase - 1u);
      if ((phase_set.phase_mask & converted_bit) == 0u) {
        phase_set.phase_mask = phase_set.phase_mask | converted_bit;
        phase_set.count = phase_set.count + 1u;
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
    var fraction = max(fractions[target_phase - 1u], 0.0);
    var component_energy = 0.0;
    var component_temperature = t0.z;
    var component_offset = vec3<f32>(0.0);
    let conversion = front_conversion(source_index);
    if (conversion.ready == 1u) {
      // A converting carrier is single-phase: its own phase keeps the
      // remainder, the next phase receives the skin at T*.
      if (target_phase == conversion.target_phase) {
        fraction = conversion.mass / s0.w;
        component_energy = conversion.target_energy;
        component_temperature = conversion.temperature;
        component_offset = conversion.face_offset;
      } else if (target_phase == conversion.own_phase) {
        fraction = (s0.w - conversion.mass) / s0.w;
        component_energy = conversion.own_energy;
        component_offset = conversion.own_offset;
      } else {
        fraction = 0.0;
      }
    } else if (
      source_phase == 3u
      && separated_vapor_retains_condensate(lineage_index, source_index)
    ) {
      if (target_phase == 3u) {
        fraction = 1.0;
        component_energy = s1.w;
        component_temperature = t0.z;
      } else {
        fraction = 0.0;
      }
    } else {
      component_energy = source_component_energy(source_index, target_phase).x;
    }
    if (!(fraction > params.fraction_activation_epsilon)) { continue; }
    let component_mass = select(
      s0.w * fraction,
      select(s0.w - conversion.mass, conversion.mass, target_phase == conversion.target_phase),
      conversion.ready == 1u
    );
    if (!(component_mass > 0.0)) { continue; }
    let mechanics_row4 = source_mechanics[source_index * 8u + 4u];
    let component_current_volume = mechanics_row4.z * mechanics_row4.w * fraction;
    aggregate.mass = aggregate.mass + component_mass;
    aggregate.current_volume = aggregate.current_volume + component_current_volume;
    aggregate.first_moment = aggregate.first_moment
      + (s0.xyz + component_offset) * component_mass;
    aggregate.momentum = aggregate.momentum + s1.xyz * component_mass;
    aggregate.internal_energy = aggregate.internal_energy + component_energy * component_mass;
    aggregate.source_kinetic_energy = aggregate.source_kinetic_energy
      + 0.5 * component_mass * dot(s1.xyz, s1.xyz);
    aggregate.temperature_mass = aggregate.temperature_mass + component_temperature * component_mass;
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
  let retained_vapor_condensate = retained_vapor_condensate_fraction(
    target_index, target_phase, phases.material_id, specific_energy
  );
  out_state[target_index * 2u] = vec4<f32>(position, aggregate.mass);
  out_state[target_index * 2u + 1u] = vec4<f32>(velocity, specific_energy);
  out_thermo[target_index * 3u] = vec4<f32>(
    phases.material_id,
    f32(target_phase),
    temperature,
    record0.z
  );
  out_thermo[target_index * 3u + 1u] = select(
    one_hot(target_phase),
    vec4<f32>(0.0, retained_vapor_condensate, 1.0 - retained_vapor_condensate, 0.0),
    retained_vapor_condensate > params.fraction_activation_epsilon
  );
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
  out_mechanics[target_index * 8u + 6u] = vec4<f32>(record1.y,
    closure_sound_speed(mechanics_record, temperature), record1.w, record2.y);
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

fn lineage_mechanics_valid(phases: LineagePhases, lineage_index: u32) -> bool {
  for (var phase_id = 1u; phase_id <= 4u; phase_id = phase_id + 1u) {
    let phase_bit = 1u << (phase_id - 1u);
    if ((phases.phase_mask & phase_bit) != 0u
        && mechanics_record_index(phases.material_id, phase_id) == INVALID_INDEX) {
      return false;
    }
    if (phase_id == 3u && (phases.phase_mask & phase_bit) != 0u) {
      let aggregate = phase_aggregate(lineage_index, phase_id);
      if (aggregate.mass > params.mass_epsilon
          && closure_sound_speed(mechanics_record_index(phases.material_id, phase_id),
            aggregate.temperature_mass / aggregate.mass) < 0.0) { return false; }
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
  if (phases.count > 0u && !lineage_mechanics_valid(phases, lineage_index)) {
    atomicOr(&evidence[2u], ERROR_MECHANICS);
    atomicAdd(&evidence[6u], 1u);
    atomicMin(&evidence[7u], lineage_index);
    return;
  }
  if (phases.count > 1u) {
    atomicAdd(&evidence[4u], 1u);
  }
  atomicAdd(&evidence[3u], 1u);
  for (var phase_id = 1u; phase_id <= 4u; phase_id = phase_id + 1u) {
    let source = phase_lane_index(lineage_index, phase_id);
    if (skin_front_conversion(source).ready == 1u) {
      atomicAdd(&evidence[8u], 1u);
    } else if (explicit_fusion_conversion(source).ready == 1u) {
      atomicAdd(&evidence[9u], 1u);
    } else if (explicit_boiling_conversion(source).ready == 1u) {
      atomicAdd(&evidence[10u], 1u);
    }
  }
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
  if (phases.valid == 0u || (phases.count > 0u && !lineage_mechanics_valid(phases, lineage_index))) {
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

const sphPhaseCarrierTransferDormancyWgsl = sphPhaseCarrierTransferWgsl
  .replace(
    '@group(0) @binding(9) var<storage, read> interface_front: array<u32>;',
    '@group(0) @binding(9) var<storage, read> interface_front: array<u32>;\n@group(0) @binding(10) var<storage, read> phase_dormant: array<u32>;'
  )
  .replace(
    'fn front_conversion(source_index: u32) -> FrontConversion {\n',
    'fn front_conversion(source_index: u32) -> FrontConversion {\n  if (source_index < arrayLength(&phase_dormant) && phase_dormant[source_index] != 0u) {\n    return FrontConversion(0u, 0u, 0u, 0.0, 0.0, 0.0, 0.0, vec3<f32>(0.0), vec3<f32>(0.0));\n  }\n'
  );

const pooledPhaseDormancyStagesByDevice = new WeakMap();

function acquirePooledPhaseDormancyStage({
  device,
  particleCount,
  thermalMaterialTable,
  absolutePressureAuthority,
  resolvedInterfaceFront,
  epsilonK
}) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let pool = pooledPhaseDormancyStagesByDevice.get(keyDevice);
  if (!pool) {
    pool = new Map();
    pooledPhaseDormancyStagesByDevice.set(keyDevice, pool);
  }
  const windows = phaseWindowsFromThermalMaterialTable(thermalMaterialTable, {
    absolutePressureAuthority
  });
  const frontEnabled = Boolean(resolvedInterfaceFront?.buffer);
  const frontHeaderWords = frontEnabled ? (resolvedInterfaceFront.headerWords >>> 0) : 0;
  const frontRowWords = frontEnabled ? (resolvedInterfaceFront.rowWords >>> 0) : 0;
  // Add a 1e-3 K conservative f32-rounding cushion on top of requested epsilonK
  // so exact (epsilonK === 0) gating stays strictly bit-identical to ungated.
  const effectiveEpsilonK = Math.max(Number(epsilonK) || 0, 1e-3);
  const windowKey = windows
    .map((w) => `${w.materialId}:${w.meltTemperatureK.toFixed(4)}:${w.boilTemperatureK.toFixed(4)}`)
    .join(',');
  const key = `${particleCount}|${effectiveEpsilonK}|${frontEnabled ? 1 : 0}|${frontHeaderWords}|${frontRowWords}|${windowKey}`;
  let stage = pool.get(key);
  if (!stage) {
    if (pool.size >= 16) {
      for (const oldStage of pool.values()) oldStage.destroy();
      pool.clear();
    }
    stage = createSchroederPhaseDormancyStage({
      device: keyDevice,
      particleCount,
      phaseWindows: windows,
      epsilonK: effectiveEpsilonK,
      frontEnabled,
      frontHeaderWords,
      frontRowWords,
      frontEpoch: 0xffffffff
    });
    pool.set(key, stage);
  }
  return stage;
}

export function sphPhaseCarrierTransferDeviceRuntimeAllocationOwnership(device) {
  if (!device || typeof device !== 'object') {
    throw new TypeError('phase-carrier runtime allocation ownership requires the exact device');
  }
  const buffers = new Set();
  const pool = pooledPhaseDormancyStagesByDevice.get(unwrapWebGpuCacheDevice(device));
  if (pool instanceof Map) {
    for (const stage of pool.values()) {
      for (const buffer of [
        stage?.dormantBuffer,
        stage?.countBuffer,
        stage?.activeIndicesBuffer,
        stage?.indirectDispatchBuffer
      ]) {
        if (buffer && typeof buffer === 'object' && typeof buffer.destroy === 'function') {
          buffers.add(buffer);
        }
      }
    }
  }
  return Object.freeze({
    schema: 'peercompute.ulg.sph-phase-carrier-transfer-runtime-allocation-ownership.v0',
    status: 'phase-carrier-transfer-runtime-allocation-ownership-complete',
    allocationCount: buffers.size,
    buffers: Object.freeze([...buffers])
  });
}

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
  // { buffer, epoch, headerWords, rowWords } from the SS thermal proposal that
  // fed this step's canonical thermal apply. Absent: no skin conversion.
  interfacePhaseFront = null,
  // G4 per-source phase dormancy ({ epsilonK = 0 }); null preserves the
  // established 2-pass ungated unit route.
  phaseDormancy = null,
  retainOutputParticleBuffers = false,
  readbackMode = NO_FULL_READBACK_MODE
} = {}, ledgerAuthority = null) {
  // Only the captured ledger route below may run the f32 split on exact
  // carriers: its reconcile pass makes the result exact.
  if (ledgerAuthority !== PHASE_LEDGER_AUTHORITY) {
    assertSphLegacyMassPathAllowed({ sphParticleState, sourceStateBuffer, sourceThermoBuffer }, 'Phase-carrier transfer');
  }
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

  const resolvedInterfaceFront = resolveSphPhaseCarrierInterfaceFront(
    interfacePhaseFront,
    device
  );
  const phaseDormancyEpsilonK = (
    phaseDormancy && Number.isFinite(Number(phaseDormancy.epsilonK)) && Number(phaseDormancy.epsilonK) >= 0
  ) ? Number(phaseDormancy.epsilonK) : null;
  const phaseDormancyStage = phaseDormancyEpsilonK != null
    ? acquirePooledPhaseDormancyStage({
        device,
        particleCount: sphParticleState.particleCount,
        thermalMaterialTable,
        absolutePressureAuthority,
        resolvedInterfaceFront,
        epsilonK: phaseDormancyEpsilonK
      })
    : null;
  const setupAllocations = [];
  const ownSetupAllocation = (buffer) => {
    if (buffer) setupAllocations.push(buffer);
    return buffer;
  };
  const {
    closureBuffer,
    evidenceValues,
    evidenceBuffer,
    stateByteLength,
    thermoByteLength,
    mechanicsByteLength,
    outStateBuffer,
    outThermoBuffer,
    outMechanicsBuffer,
    paramsBuffer,
    preflightPipeline,
    applyPipeline,
    preflightBindGroup,
    applyBindGroup,
    workgroups
  } = (() => {
    try {
      const closure = packSphPhaseCarrierTransferClosureRows(
        thermalMaterialTable,
        mechanicsMaterialTable
      );
      const closureBuffer = ownSetupAllocation(uploadStorageBuffer(
        device,
        'ulg-sph-phase-carrier-transfer-closure-rows',
        closure.values
      ));
      const evidenceValues = initialEvidence(plan.lineageCapacity);
      const evidenceBuffer = ownSetupAllocation(uploadStorageBuffer(
        device,
        'ulg-sph-phase-carrier-transfer-evidence',
        evidenceValues,
        GPU_BUFFER_USAGE.COPY_SRC
      ));
      const stateByteLength = sphParticleState.particleCount
        * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
      const thermoByteLength = sphParticleState.particleCount
        * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
      const mechanicsByteLength = mlsMpmParticleState.particleCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;
      const outStateBuffer = ownSetupAllocation(createStorageBuffer(
        device,
        'ulg-sph-phase-carrier-transfer-state',
        stateByteLength,
        GPU_BUFFER_USAGE.COPY_SRC
      ));
      const outThermoBuffer = ownSetupAllocation(createStorageBuffer(
        device,
        'ulg-sph-phase-carrier-transfer-thermo',
        thermoByteLength,
        GPU_BUFFER_USAGE.COPY_SRC
      ));
      const outMechanicsBuffer = ownSetupAllocation(createStorageBuffer(
        device,
        'ulg-sph-phase-carrier-transfer-mechanics',
        mechanicsByteLength,
        GPU_BUFFER_USAGE.COPY_SRC
      ));
      const paramsBuffer = ownSetupAllocation(device.createBuffer({
        label: 'ulg-sph-phase-carrier-transfer-params',
        size: SPH_PHASE_CARRIER_TRANSFER_PARAMS_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }));
      device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
        particleCount: sphParticleState.particleCount,
        plan,
        closure,
        absolutePressureAuthority,
        interfaceFront: resolvedInterfaceFront
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
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'read-only-storage'),
        ...(phaseDormancyStage ? [computeBufferBinding(10, 'read-only-storage')] : [])
      ];
      const activeWgsl = phaseDormancyStage
        ? sphPhaseCarrierTransferDormancyWgsl
        : sphPhaseCarrierTransferWgsl;
      const cacheSuffix = phaseDormancyStage ? '.g4phase1' : '';
      const preflightPipeline = createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sph-phase-carrier-transfer.v4.preflight${cacheSuffix}`,
        label: 'ulg-sph-phase-carrier-transfer-preflight',
        code: activeWgsl,
        entryPoint: 'preflight',
        bindings
      });
      const applyPipeline = createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sph-phase-carrier-transfer.v4.apply${cacheSuffix}`,
        label: 'ulg-sph-phase-carrier-transfer-apply',
        code: activeWgsl,
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
        { binding: 8, resource: { buffer: paramsBuffer } },
        {
          binding: 9,
          resource: {
            buffer: resolvedInterfaceFront?.buffer
              || interfaceFrontDummyBuffer(device)
          }
        },
        ...(phaseDormancyStage
          ? [{ binding: 10, resource: { buffer: phaseDormancyStage.dormantBuffer } }]
          : [])
      ];
      const preflightBindGroup = createCachedExplicitBindGroup(device, {
        label: 'ulg-sph-phase-carrier-preflight',
        layout: preflightPipeline.bindGroupLayout,
        entries: bindGroupEntries
      });
      const applyBindGroup = createCachedExplicitBindGroup(device, {
        label: 'ulg-sph-phase-carrier-apply',
        layout: applyPipeline.bindGroupLayout,
        entries: bindGroupEntries
      });
      return {
        closureBuffer,
        evidenceValues,
        evidenceBuffer,
        stateByteLength,
        thermoByteLength,
        mechanicsByteLength,
        outStateBuffer,
        outThermoBuffer,
        outMechanicsBuffer,
        paramsBuffer,
        preflightPipeline,
        applyPipeline,
        preflightBindGroup,
        applyBindGroup,
        workgroups: Math.max(1, Math.ceil(plan.lineageCapacity / 64))
      };
    } catch (error) {
      const destroyed = new Set();
      for (const buffer of [...setupAllocations].reverse()) {
        if (!buffer || destroyed.has(buffer)) continue;
        try { buffer.destroy?.(); } catch {}
        destroyed.add(buffer);
      }
      throw error;
    }
  })();
  let cleaned = false;
  let outputsDestroyed = false;
  let outputDestroyScheduled = false;
  let outputDestroyRelease = null;
  let result = null;
  const destroyedBuffers = new Set();
  const destroyBufferOnce = (buffer) => {
    if (!buffer || destroyedBuffers.has(buffer)) return;
    buffer.destroy?.();
    destroyedBuffers.add(buffer);
  };
  const outputComponentBuffers = Object.freeze({
    state: outStateBuffer,
    thermo: outThermoBuffer,
    mechanics: outMechanicsBuffer
  });
  const outputComponentsDestroyed = {
    state: false,
    thermo: false,
    mechanics: false
  };
  const destroyOutputComponentsNow = ({
    state = false,
    thermo = false,
    mechanics = false
  } = {}) => {
    const requested = { state, thermo, mechanics };
    if (!Object.values(requested).some((value) => value === true)) {
      return false;
    }
    let firstError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      for (const [component, buffer] of Object.entries(outputComponentBuffers)) {
        if (
          requested[component] !== true
          || outputComponentsDestroyed[component]
        ) continue;
        try {
          destroyBufferOnce(buffer);
          outputComponentsDestroyed[component] = true;
          if (result) {
            const ownershipField =
              `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`;
            result[ownershipField] = false;
          }
        } catch (error) {
          firstError ??= error;
        }
      }
    }
    const allComponentsDestroyed = Object.values(outputComponentsDestroyed).every(Boolean);
    if (allComponentsDestroyed) destroyBufferOnce(evidenceBuffer);
    outputsDestroyed = allComponentsDestroyed;
    const requestedComplete = Object.entries(requested).every(
      ([component, selected]) => (
        selected !== true || outputComponentsDestroyed[component] === true
      )
    );
    if (requestedComplete) return true;
    throw firstError || new Error(
      'Phase-carrier retained output component destruction was incomplete'
    );
  };
  const destroyOutputs = () => {
    if (outputsDestroyed) return true;
    return destroyOutputComponentsNow({
      state: true,
      thermo: true,
      mechanics: true
    });
  };
  const cleanup = () => {
    if (cleaned) return;
    let firstError = null;
    for (const buffer of [
      closureBuffer,
      ...(retainOutputParticleBuffers ? [] : [evidenceBuffer]),
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
  result = {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_SCHEMA,
    status: 'phase-carrier-transfer-submitted',
    backend: 'webgpu',
    encodedDispatchCount: 2,
    particleCount: sphParticleState.particleCount,
    phaseCarrierPlan: { ...phaseCarrierPlan },
    lineageCapacity: plan.lineageCapacity,
    primaryCapacity: plan.primaryCapacity,
    phaseLaneCount: plan.phaseLaneCount,
    phaseLaneStride: plan.phaseLaneStride,
    companionStart: plan.companionStart,
    lineageCount: plan.lineageCapacity,
    interfacePhaseFrontConsumed: Boolean(resolvedInterfaceFront),
    interfacePhaseFrontEpoch: resolvedInterfaceFront?.epoch ?? 0,
    state: new Float32Array(),
    thermo: new Float32Array(),
    mechanics: new Float32Array(),
    evidence: null,
    evidenceBuffer: retainOutputParticleBuffers ? evidenceBuffer : null,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    mechanicsBuffer: retainOutputParticleBuffers ? outMechanicsBuffer : null,
    ownsStateBuffer: retainOutputParticleBuffers,
    ownsThermoBuffer: retainOutputParticleBuffers,
    ownsMechanicsBuffer: retainOutputParticleBuffers,
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
    conservationPolicy: 'mass-momentum-first-moment-total-energy-with-phase-rest-volume-materialization-and-relative-kinetic-thermalization',
    destroyOutputParticleBufferComponents: retainOutputParticleBuffers
      ? destroyOutputComponentsNow
      : null,
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
    phaseDormancy: phaseDormancyStage
      ? Object.freeze({
          schema: 'ulg.schroeder-phase-dormancy.v1',
          epsilonK: phaseDormancyEpsilonK,
          predicate: 'pure-phase-distance-from-transition-and-front',
          countBuffer: phaseDormancyStage.countBuffer,
          dormantBuffer: phaseDormancyStage.dormantBuffer,
          activeIndicesBuffer: phaseDormancyStage.activeIndicesBuffer,
          indirectDispatchBuffer: phaseDormancyStage.indirectDispatchBuffer,
          indirectDispatchOffset: phaseDormancyStage.indirectDispatchOffset ?? 16
        })
      : null,
    scientificValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: 'peercompute.ulg.sph-phase-carrier-transfer-encoder-stage.v2',
    status: 'phase-carrier-transfer-encoder-stage-ready',
    encodedDispatchCount: phaseDormancyStage ? 5 : 2,
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
      if (phaseDormancyStage) {
        // Coalesce G4 phase dormancy classification + preflight + apply into ONE
        // compute pass (saving 1 compute pass/step) and record exact counts into
        // the per-schedule lawActivationReceiptRing.
        const pass = encoder.beginComputePass({ label: 'ulg-sph-phase-carrier-transfer' });
        phaseDormancyStage.encodeIntoPass(pass, {
          stateBuffer: sourceStateBuffer,
          thermoBuffer: sourceThermoBuffer,
          interfaceFrontBuffer: resolvedInterfaceFront?.buffer ?? null
        });
        pass.setPipeline(preflightPipeline.pipeline);
        pass.setBindGroup(0, preflightBindGroup);
        pass.dispatchWorkgroups(workgroups);
        pass.setPipeline(applyPipeline.pipeline);
        pass.setBindGroup(0, applyBindGroup);
        pass.dispatchWorkgroups(workgroups);
        pass.end();
        encodeLawActivationCount(encoder, device, 'phase', phaseDormancyStage.countBuffer, {
          epsilon: phaseDormancyEpsilonK
        });
        const phaseDiag = (globalThis.__ulgPhaseDormancy ??= { encodes: 0 });
        phaseDiag.encodes += 1;
        phaseDiag.device = device;
        phaseDiag.stage = phaseDormancyStage;
        phaseDiag.epsilonK = phaseDormancyEpsilonK;
        phaseDiag.particleCount = sphParticleState.particleCount;
        return;
      }
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
    cleanupRetainedOutput: destroyOutputs,
    cleanupRetainedOutputComponents: destroyOutputComponentsNow
  };
}

const phaseSourceCaptures = new WeakMap();
const PHASE_LEDGER_AUTHORITY = Object.freeze({});

// Integer energy ledger (g2-integer-ledger-proposal.md, Phase 2): a captured
// phase transfer whose thermal input carries an exact energy record runs the
// f32 split and then the reconcile pass that makes it exact.
function validatePhaseLedgerInput(args, ledger, token) {
  const seal = ledger?.thermalSeal;
  if (!token || !seal?.exactEnergy || typeof seal.validate !== 'function' || !ledger.sourceRead?.read) {
    throw new TypeError('Ledger phase transfer requires a captured thermal energy record');
  }
  seal.validate();
  if (seal.output?.stateBuffer !== args.sourceStateBuffer || seal.output?.thermoBuffer !== args.sourceThermoBuffer) {
    throw new TypeError('Ledger phase transfer input differs from its genuine thermal output');
  }
  if (ledger.massRead != null && (ledger.massRead.rowCount !== seal.exactEnergy.rowCount
      || ledger.massRead.format !== seal.exactEnergy.format)) {
    throw new TypeError('Ledger phase transfer mass rows differ from its energy record');
  }
}

export function resolveSphPhaseCarrierTransferSourceCapture(result, token) {
  const seal = phaseSourceCaptures.get(token);
  if (!seal || seal.result !== result) throw new Error('Unknown phase-transfer source capture');
  seal.validate();
  return seal;
}

export async function runSphPhaseCarrierTransferWebGpu(args = {}) {
  const token = args.postMechanicsSourceCapture ?? null;
  if (token) {
    if (phaseSourceCaptures.has(token)) throw new Error('Phase-transfer source capture cannot replay');
    phaseSourceCaptures.set(token, null);
    if (args.retainOutputParticleBuffers !== true) throw new Error('Phase capture requires retained outputs');
  }
  const capturedInputs = token ? { device: args.device, sphParticleState: args.sphParticleState,
    thermalMaterialTable: args.thermalMaterialTable, mechanicsMaterialTable: args.mechanicsMaterialTable,
    mlsMpmParticleState: args.mlsMpmParticleState, sourceStateBuffer: args.sourceStateBuffer,
    sourceThermoBuffer: args.sourceThermoBuffer, sourceMechanicsBuffer: args.sourceMechanicsBuffer } : null;
  const exactRequested = args.exactThermalResult != null || args.exactReactionResult != null;
  const exactLedger = args.exactLedger ?? null;
  if (exactLedger) {
    if (exactRequested) throw new TypeError('A phase transfer is either exact-rational or ledger, not both');
    validatePhaseLedgerInput(args, exactLedger, token);
  }
  const stage = exactRequested
    ? await (await import('./sphExactPhaseCarrierStageGpu.js')).prepareSphExactPhaseCarrierStage(args)
    : createSphPhaseCarrierTransferWebGpuEncoderStage(args, exactLedger ? PHASE_LEDGER_AUTHORITY : null);
  let ledgerStage = null;
  if (exactLedger) {
    const plan = args.phaseCarrierPlan ?? args.sphParticleState?.phaseCarrierPlan;
    try {
      ledgerStage = (await import('./sphExactPhaseLedgerReconcileGpu.js')).createSphExactPhaseLedgerReconcileStage({
        device: args.device, lineageCount: Number(plan?.lineageCapacity), laneStride: Number(plan?.phaseLaneStride),
        particleCount: args.sphParticleState.particleCount, inputStateBuffer: args.sourceStateBuffer,
        outStateBuffer: stage.stateBuffer, outThermoBuffer: stage.thermoBuffer, outMechanicsBuffer: stage.mechanicsBuffer,
        // After a ledger reaction the reaction's successor rows are the input.
        massRead: exactLedger.massRead ?? exactLedger.sourceRead.read, energy: exactLedger.thermalSeal.exactEnergy });
    } catch (error) { stage.cleanupSubmittedWork(); stage.cleanupRetainedOutput?.(); throw error; }
  }
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
  let submittedWorkCleanupClaim = null;
  let submittedWorkFinalConsumer = null;
  let outputCleanupClaim = null;
  let ledgerCommitted = null;
  try {
  const encoder = device.createCommandEncoder();
  stage.encode(encoder);
  ledgerStage?.encode(encoder);
  const commandBuffer = encoder.finish();
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
  stage.markSubmitted?.();
    if (ledgerStage) {
      markSphExactMassDerivedBuffers(exactLedger.sourceRead, [stage.stateBuffer, stage.thermoBuffer],
        { mechanicsBuffers: [stage.mechanicsBuffer] });
    }
    ledgerCommitted = ledgerStage?.commit() ?? null;
  } catch (error) {
    // Nothing reached the queue: the successor records were never written.
    if (!ledgerCommitted) ledgerStage?.abandon();
    throw error;
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
    stage.result.interfaceFrontConversionCount = stage.result.evidence[8];
    stage.result.explicitFusionConversionCount = stage.result.evidence[9];
    stage.result.explicitBoilingConversionCount = stage.result.evidence[10];
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
  if (token) {
    const base = createPostMechanicsStageOutputSeal(stage.result, capturedInputs, {
      onLastRelease: stage.exactPhase ? () => {
        void Promise.all([stage.releaseSource(), stage.releaseInventory(), stage.releaseQuantityStorage()]).catch(() => {});
      } : ledgerCommitted ? () => {
        void ledgerStage.releaseUnadopted(ledgerCommitted).catch(() => {});
      } : null
    });
    phaseSourceCaptures.set(token, stage.exactPhase ? Object.freeze({ ...base, exactPhase: stage.exactPhase,
      validate() { base.validate(); stage.validateOutput(); return true; } })
      : ledgerCommitted ? Object.freeze({ ...base, exactLedgerPhase: ledgerCommitted,
        sourceParticleRead: exactLedger.sourceRead,
        phaseValidationBuffer: stage.evidenceBuffer,
        validate() {
          base.validate();
          if (stage.result.evidenceBuffer !== stage.evidenceBuffer) {
            throw new TypeError('Captured phase validation buffer was replaced');
          }
          return true;
        }
      }) : base);
    if (stage.exactPhase) {
      try { await stage.completeInventory(stage.result, token); }
      catch (error) {
        phaseSourceCaptures.delete(token); base.release();
        const cleanup = stage.abandon(); void cleanup.catch(() => {});
        error.exactPhaseCleanupCompletion = cleanup; throw error;
      }
    }
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
